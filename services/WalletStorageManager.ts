/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Wallet } from '../model/Wallet';
import { WalletRepository } from '../model/WalletRepository';
import { BiometricService } from './BiometricService';
import { getGlobalWorkletLogging } from './interfaces/IWorkletLogging';

export class WalletStorageManager {
  private static readonly WALLET_KEY = 'wallet_data';
  private static readonly ENCRYPTION_KEY = 'wallet_encryption_key';
  private static readonly WALLET_HAS_PASSWORD_KEY = 'wallet_has_password';
  private static readonly BIOMETRIC_SALT_KEY = 'biometric_salt';
  private static readonly CUSTOM_NODE_KEY = 'custom_node_url';
  private static readonly PASSWORD_DERIVED_KEY = 'password_derived_key';
  private static readonly PASSWORD_HASH_KEY = 'password_hash';

  // Temporary storage for current session's password key (cleared on app restart)
  private static currentSessionPasswordKey: string | null = null;

  private static logFailure(context: string): void {
    try {
      getGlobalWorkletLogging().logging1string(`WalletStorageManager: ${context}`);
    } catch {
      // worklet logging unavailable
    }
  }

  // Migration: Check if wallet exists in AsyncStorage and migrate to SecureStore
  private static async migrateWalletFromAsyncStorage(): Promise<void> {
    // Only run migration on native platforms (not web)
    if (Platform.OS === 'web') return;

    try {
      // First check if we already have data in SecureStore
      const existingData = await SecureStore.getItemAsync(WalletStorageManager.WALLET_KEY);
      if (existingData && existingData.length > 0) {
        // Already migrated - wallet data exists in SecureStore
        return;
      }

      // Check for old wallet data in AsyncStorage
      const oldData = await AsyncStorage.getItem(WalletStorageManager.WALLET_KEY);
      if (oldData && oldData.length > 0) {
        // Migrate wallet data to SecureStore
        await SecureStore.setItemAsync(WalletStorageManager.WALLET_KEY, oldData);

        // Also migrate related keys
        const hasPassword = await AsyncStorage.getItem(WalletStorageManager.WALLET_HAS_PASSWORD_KEY);
        if (hasPassword) {
          await SecureStore.setItemAsync(WalletStorageManager.WALLET_HAS_PASSWORD_KEY, hasPassword);
        }

        const biometricSalt = await AsyncStorage.getItem(WalletStorageManager.BIOMETRIC_SALT_KEY);
        if (biometricSalt) {
          await SecureStore.setItemAsync(WalletStorageManager.BIOMETRIC_SALT_KEY, biometricSalt);
        }

        const passwordDerivedKey = await AsyncStorage.getItem(WalletStorageManager.PASSWORD_DERIVED_KEY);
        if (passwordDerivedKey) {
          await SecureStore.setItemAsync(WalletStorageManager.PASSWORD_DERIVED_KEY, passwordDerivedKey);
        }

        const passwordHash = await AsyncStorage.getItem(WalletStorageManager.PASSWORD_HASH_KEY);
        if (passwordHash) {
          await SecureStore.setItemAsync(WalletStorageManager.PASSWORD_HASH_KEY, passwordHash);
        }

        // Delete old data from AsyncStorage
        await AsyncStorage.removeItem(WalletStorageManager.WALLET_KEY);
        await AsyncStorage.removeItem(WalletStorageManager.WALLET_HAS_PASSWORD_KEY);
        await AsyncStorage.removeItem(WalletStorageManager.BIOMETRIC_SALT_KEY);
        await AsyncStorage.removeItem(WalletStorageManager.PASSWORD_DERIVED_KEY);
        await AsyncStorage.removeItem(WalletStorageManager.PASSWORD_HASH_KEY);
      }
    } catch {
      WalletStorageManager.logFailure('storage migration failed');
      // Don't throw - let the app try to continue
    }
  }

  static async saveEncryptedWalletData(encryptedData: any): Promise<void> {
    try {
      const data = JSON.stringify(encryptedData);
      if (Platform.OS === 'web') {
        localStorage.setItem(WalletStorageManager.WALLET_KEY, data);
      } else {
        // Use SecureStore for better persistence (backed by Android Keystore)
        // This is more secure AND more persistent than AsyncStorage
        await SecureStore.setItemAsync(WalletStorageManager.WALLET_KEY, data);
      }
    } catch {
      WalletStorageManager.logFailure('save wallet failed');
      throw new Error('Failed to save encrypted wallet');
    }
  }

  static async getWallet(): Promise<Wallet | null> {
    try {
      // Migration: Check if wallet exists in AsyncStorage and migrate to SecureStore
      await WalletStorageManager.migrateWalletFromAsyncStorage();

      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(WalletStorageManager.WALLET_KEY);
      } else {
        // Read from SecureStore (more persistent than AsyncStorage)
        data = await SecureStore.getItemAsync(WalletStorageManager.WALLET_KEY);
      }

      if (!data) {
        return null;
      }

      const parsedData = JSON.parse(data);

      // Check if this is encrypted data (has 'data' and 'nonce' properties)
      if (parsedData.data && parsedData.nonce) {
        const useBiometric = await BiometricService.isBiometricChecked();

        if (useBiometric) {
          // Biometric mode: authenticate with biometric and decrypt with biometric key
          return await WalletStorageManager.authenticateWithBiometric();
        }
        // Password mode: prompt for password and decrypt with password
        return await WalletStorageManager.authenticateWithPassword();
      }

      // Unencrypted data is not allowed - this is a security violation
      WalletStorageManager.logFailure('unencrypted wallet data cleared');

      // Clear the unencrypted data immediately
      await WalletStorageManager.clearWallet();

      // Return null - user will need to create a new wallet
      return null;
    } catch {
      WalletStorageManager.logFailure('load wallet failed');
      return null;
    }
  }

  private static async authenticateWithBiometric(): Promise<Wallet | null> {
    try {
      // Check if biometric salt exists
      const biometricSalt = await WalletStorageManager.getBiometricSalt();
      if (!biometricSalt) {
        return await WalletStorageManager.authenticateWithPassword();
      }

      // Authenticate with biometric
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false, // Allow PIN fallback for better user experience
      });

      if (result.success) {
        const wallet = await WalletStorageManager.getDecryptedWalletWithBiometric();
        if (wallet) {
          return wallet;
        }
        return null;
      }
      return await WalletStorageManager.authenticateWithPassword();
    } catch {
      WalletStorageManager.logFailure('wallet unlock failed');
      return null;
    }
  }

  private static async authenticateWithPassword(): Promise<Wallet | null> {
    try {
      // Prompt for password using the global context
      const passwordPromptContext = (global as any).passwordPromptContext;
      if (!passwordPromptContext) {
        throw new Error('Password prompt context not available. App must be properly initialized.');
      }

      const password = await passwordPromptContext.showPasswordPromptAlert(
        'Wallet Password Required',
        'Enter your wallet password to access the app:'
      );

      if (!password) {
        return null;
      }

      // First verify the password against stored hash and get the stored derived key
      const storedDerivedKey = await WalletStorageManager.verifyPasswordAndGetKey(password);
      if (!storedDerivedKey) {
        return null;
      }

      // Now decrypt the wallet using the stored derived key
      const wallet = await WalletStorageManager.getDecryptedWalletWithDerivedKey(storedDerivedKey);
      if (wallet) {
        // Store the derived key for quiet saves during sync
        WalletStorageManager.setCurrentSessionPasswordKey(storedDerivedKey);

        return wallet;
      }
      return null;
    } catch {
      WalletStorageManager.logFailure('wallet unlock failed');
      return null;
    }
  }

  /** Step 1 gate for sensitive actions (export file): biometric OR app unlock password. */
  static async authenticateForSensitiveAction(): Promise<boolean> {
    try {
      const useBiometric = await BiometricService.isBiometricChecked();
      if (useBiometric) {
        const authenticated = await BiometricService.authenticateWithBiometric();
        if (authenticated) {
          return true;
        }
      }

      const passwordPromptContext = (global as any).passwordPromptContext;
      if (!passwordPromptContext) {
        throw new Error('Password prompt context not available');
      }

      const password = await passwordPromptContext.showPasswordPromptAlert(
        'Authentication Required',
        'Enter your wallet password to continue:'
      );
      if (!password) {
        return false;
      }

      const storedDerivedKey = await WalletStorageManager.verifyPasswordAndGetKey(password);
      return storedDerivedKey !== null;
    } catch {
      WalletStorageManager.logFailure('sensitive action auth failed');
      return false;
    }
  }

  static async clearWallet(): Promise<void> {
    try {
      const walletKeys = [
        WalletStorageManager.WALLET_KEY,
        WalletStorageManager.ENCRYPTION_KEY,
        WalletStorageManager.WALLET_HAS_PASSWORD_KEY,
        WalletStorageManager.BIOMETRIC_SALT_KEY,
        WalletStorageManager.PASSWORD_DERIVED_KEY,
        WalletStorageManager.PASSWORD_HASH_KEY,
      ];

      if (Platform.OS === 'web') {
        for (const key of walletKeys) {
          localStorage.removeItem(key);
        }
      } else {
        await Promise.all(
          walletKeys.map(async (key) => {
            try {
              await SecureStore.deleteItemAsync(key);
            } catch {
              // Missing keys are fine during wipe
            }
            await AsyncStorage.removeItem(key);
          })
        );
      }
    } catch {
      WalletStorageManager.logFailure('clear wallet failed');
      throw new Error('Failed to clear wallet');
    }
  }

  // Methods that use WalletRepository for encryption/decryption
  static async saveEncryptedWallet(wallet: Wallet, password: string): Promise<void> {
    try {
      // Check authentication mode to determine key derivation
      const isBiometricMode = await BiometricService.isBiometricEnabled();

      let encryptionKey: string;

      if (isBiometricMode) {
        // Biometric mode: derive biometric key
        const biometricKey = await WalletStorageManager.deriveBiometricKey();
        if (!biometricKey) {
          throw new Error('Failed to derive biometric key');
        }
        encryptionKey = biometricKey;
      } else {
        // Password mode: derive password key
        encryptionKey = await WalletStorageManager.derivePasswordKey(password);
      }

      // Always encrypt with derived key, never human password
      const encryptedWallet = WalletRepository.save(wallet, encryptionKey);
      await WalletStorageManager.saveEncryptedWalletData(encryptedWallet);
      await SecureStore.setItemAsync(WalletStorageManager.WALLET_HAS_PASSWORD_KEY, 'true');
    } catch {
      WalletStorageManager.logFailure('persist wallet failed');
      throw new Error('Failed to save encrypted wallet');
    }
  }

  /**
   * New method for password mode with persistent derived keys
   */
  static async saveEncryptedWalletWithPersistentKey(wallet: Wallet, password: string): Promise<void> {
    try {
      // Derive the key and encrypt with it
      const derivedKey = await WalletStorageManager.derivePasswordKey(password);
      const encryptedWallet = WalletRepository.save(wallet, derivedKey);
      await WalletStorageManager.saveEncryptedWalletData(encryptedWallet);

      // Store the persistent derived key and password hash
      await WalletStorageManager.storePersistentPasswordKey(password);
      WalletStorageManager.setCurrentSessionPasswordKey(derivedKey);

      // Set the password flag
      await SecureStore.setItemAsync(WalletStorageManager.WALLET_HAS_PASSWORD_KEY, 'true');
    } catch {
      WalletStorageManager.logFailure('persist wallet failed');
      throw new Error('Failed to save encrypted wallet with persistent key');
    }
  }

  static async getEncryptedWallet(password: string): Promise<Wallet | null> {
    try {
      const walletData = await WalletStorageManager.getWallet();
      return WalletRepository.getLocalWalletWithPassword(password, walletData);
    } catch {
      WalletStorageManager.logFailure('load wallet failed');
      return null;
    }
  }

  static async getDecryptedWalletWithPassword(password: string): Promise<Wallet | null> {
    try {
      // Get raw encrypted data directly, bypassing authentication
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(WalletStorageManager.WALLET_KEY);
      } else {
        // Read from SecureStore for persistence
        data = await SecureStore.getItemAsync(WalletStorageManager.WALLET_KEY);
      }

      if (!data) return null;

      const parsedData = JSON.parse(data);

      // Check if this is encrypted data (has 'data' and 'nonce' properties)
      if (parsedData.data && parsedData.nonce) {
        // Directly decrypt with provided password
        return WalletRepository.decodeWithPassword(parsedData, password);
      }

      // Unencrypted data is not allowed - this is a security violation
      WalletStorageManager.logFailure('unencrypted wallet data rejected');
      return null;
    } catch {
      WalletStorageManager.logFailure('decrypt wallet failed');
      return null;
    }
  }

  static async getDecryptedWalletWithDerivedKey(derivedKey: string): Promise<Wallet | null> {
    try {
      // Get raw encrypted data directly
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(WalletStorageManager.WALLET_KEY);
      } else {
        // Read from SecureStore for persistence
        data = await SecureStore.getItemAsync(WalletStorageManager.WALLET_KEY);
      }

      if (!data) return null;

      const parsedData = JSON.parse(data);

      // Check if this is encrypted data (has 'data' and 'nonce' properties)
      if (parsedData.data && parsedData.nonce) {
        // Decrypt with the stored derived key
        return WalletRepository.decodeWithPassword(parsedData, derivedKey);
      }

      // Unencrypted data is not allowed - this is a security violation
      WalletStorageManager.logFailure('unencrypted wallet data rejected');
      return null;
    } catch {
      WalletStorageManager.logFailure('decrypt wallet failed');
      return null;
    }
  }

  static async getDecryptedWalletWithBiometric(): Promise<Wallet | null> {
    try {
      // Get raw encrypted data directly
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(WalletStorageManager.WALLET_KEY);
      } else {
        // Read from SecureStore for persistence
        data = await SecureStore.getItemAsync(WalletStorageManager.WALLET_KEY);
      }

      if (!data) return null;

      const parsedData = JSON.parse(data);

      // Check if this is encrypted data (has 'data' and 'nonce' properties)
      if (parsedData.data && parsedData.nonce) {
        // Derive biometric key from device capabilities + salt
        const biometricKey = await WalletStorageManager.deriveBiometricKey();
        if (!biometricKey) {
          return null;
        }

        // Decrypt with derived biometric key
        try {
          return WalletRepository.decodeWithPassword(parsedData, biometricKey);
        } catch {
          return null;
        }
      }

      // Unencrypted data is not allowed - this is a security violation
      WalletStorageManager.logFailure('unencrypted wallet data rejected');
      return null;
    } catch {
      WalletStorageManager.logFailure('decrypt wallet failed');
      return null;
    }
  }

  static async hasAnyWalletData(): Promise<boolean> {
    try {
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(WalletStorageManager.WALLET_KEY);
      } else {
        // Check SecureStore (more persistent than AsyncStorage)
        data = await SecureStore.getItemAsync(WalletStorageManager.WALLET_KEY);
      }

      // Return true if any data exists
      return data !== null;
    } catch {
      WalletStorageManager.logFailure('wallet presence check failed');
      return false;
    }
  }

  // Biometric authentication methods
  static async isBiometricAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch {
      WalletStorageManager.logFailure('biometric availability check failed');
      return false;
    }
  }

  static async walletHasPassword(): Promise<boolean> {
    try {
      const hasPassword = await SecureStore.getItemAsync(WalletStorageManager.WALLET_HAS_PASSWORD_KEY);
      return hasPassword === 'true';
    } catch {
      WalletStorageManager.logFailure('wallet password check failed');
      return false;
    }
  }

  static async getWalletWithBiometric(): Promise<Wallet | null> {
    try {
      const isBiometricEnabled = await BiometricService.isBiometricEnabled();
      if (!isBiometricEnabled) {
        return null;
      }

      // Authenticate with biometric
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const wallet = await WalletStorageManager.getWallet();
        if (wallet) {
          return wallet;
        }
      }

      return null;
    } catch {
      WalletStorageManager.logFailure('wallet unlock failed');
      return null;
    }
  }

  static async authenticateAndGetWallet(): Promise<Wallet | null> {
    try {
      const isBiometricEnabled = await BiometricService.isBiometricEnabled();

      if (isBiometricEnabled) {
        // Try biometric first
        const wallet = await WalletStorageManager.getWalletWithBiometric();
        if (wallet) {
          return wallet;
        }
        // Biometric failed, fallback to password
      }

      const passwordPromptContext = (global as any).passwordPromptContext;
      if (!passwordPromptContext) {
        WalletStorageManager.logFailure('wallet unlock failed');
        return null;
      }

      const password = await passwordPromptContext.showPasswordPromptAlert('Wallet Password', 'Enter your wallet password:');
      if (!password) {
        return null;
      }

      return await WalletStorageManager.getEncryptedWallet(password);
    } catch {
      WalletStorageManager.logFailure('wallet unlock failed');
      return null;
    }
  }

  // New biometric salt methods
  static async generateAndStoreBiometricSalt(userPassword: string): Promise<void> {
    try {
      // Check if salt already exists - if so, DON'T overwrite it!
      // The salt should only change when user explicitly switches between biometric and password modes
      const existingSalt = await SecureStore.getItemAsync(WalletStorageManager.BIOMETRIC_SALT_KEY);
      if (existingSalt) {
        return;
      }

      const salt = await WalletStorageManager.deriveSaltFromPassword(userPassword);
      await SecureStore.setItemAsync(WalletStorageManager.BIOMETRIC_SALT_KEY, salt);
    } catch {
      WalletStorageManager.logFailure('biometric salt setup failed');
      throw new Error('Failed to generate biometric salt');
    }
  }

  static async getBiometricSalt(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(WalletStorageManager.BIOMETRIC_SALT_KEY);
    } catch {
      WalletStorageManager.logFailure('biometric salt read failed');
      return null;
    }
  }

  private static async deriveSaltFromPassword(password: string): Promise<string> {
    // Simple salt derivation using expo-crypto
    const data = password + 'biometric_salt';
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
  }

  static async deriveBiometricKey(): Promise<string | null> {
    try {
      const salt = await WalletStorageManager.getBiometricSalt();
      if (!salt) {
        return null;
      }

      // Generate a consistent biometric identifier based on device capabilities
      const biometricIdentifier = await WalletStorageManager.generateBiometricIdentifier();

      // Derive key from biometric identifier + salt using expo-crypto
      const data = biometricIdentifier + salt;
      return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
    } catch {
      WalletStorageManager.logFailure('biometric key derivation failed');
      return null;
    }
  }

  private static async generateBiometricIdentifier(): Promise<string> {
    try {
      // Get device-specific information to create a unique identifier
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      // Create a consistent identifier based on device capabilities
      const deviceInfo = {
        hasHardware,
        isEnrolled,
        supportedTypes: supportedTypes.sort(), // Sort for consistency
        platform: Platform.OS,
        // Add a device-specific constant (this could be enhanced with device ID)
        deviceConstant: 'conceal_wallet_biometric',
      };

      const identifierString = JSON.stringify(deviceInfo);
      return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, identifierString);
    } catch {
      WalletStorageManager.logFailure('biometric identifier failed');
      return 'fallback_biometric_identifier';
    }
  }

  private static async promptForPassword(message: string): Promise<string | null> {
    const passwordPromptContext = (global as any).passwordPromptContext;
    if (!passwordPromptContext) {
      WalletStorageManager.logFailure('wallet unlock failed');
      return null;
    }
    const password = await passwordPromptContext.showPasswordPromptAlert('Wallet Password Required', message);
    return password || null;
  }

  // Custom Node Management Methods
  static async getCustomNode(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(WalletStorageManager.CUSTOM_NODE_KEY);
    } catch {
      WalletStorageManager.logFailure('custom node read failed');
      return null;
    }
  }

  static async setCustomNode(nodeUrl: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(WalletStorageManager.CUSTOM_NODE_KEY, nodeUrl);
      return true;
    } catch {
      WalletStorageManager.logFailure('custom node save failed');
      return false;
    }
  }

  static async clearCustomNode(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(WalletStorageManager.CUSTOM_NODE_KEY);
      return true;
    } catch {
      WalletStorageManager.logFailure('custom node clear failed');
      return false;
    }
  }

  /**
   * Store the current session's password key for quiet saves during sync
   * This is called after successful password authentication
   */
  static setCurrentSessionPasswordKey(passwordKey: string): void {
    WalletStorageManager.currentSessionPasswordKey = passwordKey;
  }

  /**
   * Get the current session's password key for quiet saves
   * Returns null if no key is stored (user not authenticated or biometric mode)
   */
  static getStoredPasswordKey(): string | null {
    return WalletStorageManager.currentSessionPasswordKey;
  }

  /** Persistent derived key from SecureStore (survives until app restart). */
  static async getPersistentPasswordKey(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(WalletStorageManager.PASSWORD_DERIVED_KEY);
    } catch {
      WalletStorageManager.logFailure('password key read failed');
      return null;
    }
  }

  /**
   * Session key first, then persistent derived key — avoids re-prompting after wallet creation.
   */
  static async getAvailablePasswordEncryptionKey(): Promise<string | null> {
    return WalletStorageManager.getStoredPasswordKey() ?? (await WalletStorageManager.getPersistentPasswordKey());
  }

  /**
   * Clear the current session's password key (called on logout/app restart)
   */
  static clearCurrentSessionPasswordKey(): void {
    WalletStorageManager.currentSessionPasswordKey = null;
  }

  /**
   * Store the persistent derived password key and password hash
   * This is called when setting up password mode
   */
  static async storePersistentPasswordKey(password: string): Promise<void> {
    try {
      const derivedKey = await WalletStorageManager.derivePasswordKey(password);
      const passwordHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);

      await SecureStore.setItemAsync(WalletStorageManager.PASSWORD_DERIVED_KEY, derivedKey);
      await SecureStore.setItemAsync(WalletStorageManager.PASSWORD_HASH_KEY, passwordHash);
    } catch {
      WalletStorageManager.logFailure('password key storage failed');
      throw new Error('Failed to store password key');
    }
  }

  /**
   * Verify password against stored hash and return stored derived key
   * Returns null if password is invalid
   */
  static async verifyPasswordAndGetKey(password: string): Promise<string | null> {
    try {
      const storedHash = await SecureStore.getItemAsync(WalletStorageManager.PASSWORD_HASH_KEY);
      const storedKey = await SecureStore.getItemAsync(WalletStorageManager.PASSWORD_DERIVED_KEY);

      if (!storedHash || !storedKey) {
        return null;
      }

      const passwordHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);

      if (passwordHash !== storedHash) {
        return null;
      }

      return storedKey;
    } catch {
      WalletStorageManager.logFailure('password verification failed');
      return null;
    }
  }

  /**
   * Clear persistent password data
   */
  static async clearPersistentPasswordData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(WalletStorageManager.PASSWORD_DERIVED_KEY);
      await SecureStore.deleteItemAsync(WalletStorageManager.PASSWORD_HASH_KEY);
    } catch {
      WalletStorageManager.logFailure('password data clear failed');
    }
  }

  /**
   * Derive password key from password (EXACT same as WalletRepository.getEncrypted())
   */
  static async derivePasswordKey(password: string): Promise<string> {
    // Use the EXACT same key derivation as WalletRepository.getEncrypted()
    let normalizedPassword = password;
    if (normalizedPassword.length > 32) {
      normalizedPassword = normalizedPassword.substr(0, 32);
    }
    if (normalizedPassword.length < 32) {
      normalizedPassword = ('00000000000000000000000000000000' + normalizedPassword).slice(-32);
    }

    // Convert to bytes (same as WalletRepository)
    let privKey = new TextEncoder().encode(normalizedPassword);

    // Fix cyrillic (non-latin) passwords (same as WalletRepository)
    if (privKey.length > 32) {
      privKey = privKey.slice(-32);
    }

    // Convert to hex string for storage
    return Array.from(privKey)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
