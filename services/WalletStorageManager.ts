/**
*     Copyright (c) 2025, Acktarius 
*/
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { Platform, Alert } from 'react-native';
import { WalletRepository } from '../model/WalletRepository';
import { Wallet } from '../model/Wallet';
import { BiometricService } from './BiometricService';

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

  static async saveEncryptedWalletData(encryptedData: any): Promise<void> {
    try {
      const data = JSON.stringify(encryptedData);
      if (Platform.OS === 'web') {
        localStorage.setItem(this.WALLET_KEY, data);
      } else {
        await AsyncStorage.setItem(this.WALLET_KEY, data);
      }
    } catch (error) {
      console.error('Error saving encrypted wallet:', error);
      throw new Error('Failed to save encrypted wallet');
    }
  }

  static async getWallet(): Promise<Wallet | null> {
    try {
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(this.WALLET_KEY);
      } else {
        data = await AsyncStorage.getItem(this.WALLET_KEY);
      }
      
      if (!data) return null;
      
      const parsedData = JSON.parse(data);
      
      // Check if this is encrypted data (has 'data' and 'nonce' properties)
      if (parsedData.data && parsedData.nonce) {
        console.log('WALLET STORAGE: Found encrypted wallet data, checking authentication mode...');
        
        const isBiometricEnabled = await BiometricService.isBiometricEnabled();
        console.log('Authentication mode:', isBiometricEnabled ? 'BIOMETRIC' : 'PASSWORD');
        
        if (isBiometricEnabled) {
          // Biometric mode: authenticate with biometric and decrypt with biometric key
          return await this.authenticateWithBiometric();
        } else {
          // Password mode: prompt for password and decrypt with password
          return await this.authenticateWithPassword();
        }
      }
      
      // Unencrypted data is not allowed - this is a security violation
      console.error('SECURITY VIOLATION: Found unencrypted wallet data!');
      console.error('All wallet data must be encrypted at rest. Clearing unencrypted data.');
      
      // Clear the unencrypted data immediately
      await this.clearWallet();
      
      // Return null - user will need to create a new wallet
      return null;
    } catch (error) {
      console.error('Error loading wallet:', error);
      return null;
    }
  }

  private static async authenticateWithBiometric(): Promise<Wallet | null> {
    try {
      console.log('BIOMETRIC: Starting biometric authentication...');
      
      // Check if biometric salt exists
      const biometricSalt = await this.getBiometricSalt();
      if (!biometricSalt) {
        console.log('BIOMETRIC: No biometric salt found, falling back to password');
        return await this.authenticateWithPassword();
      }
      
      // Authenticate with biometric
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false, // Allow PIN fallback for better user experience
      });
      
      if (result.success) {
        console.log('BIOMETRIC: Authentication successful, decrypting wallet...');
        const wallet = await this.getDecryptedWalletWithBiometric();
        if (wallet) {
          console.log('BIOMETRIC: Wallet decrypted successfully');
          console.log('BIOMETRIC: Wallet keys after decryption:', {
            hasSpendKey: !!wallet.keys?.priv?.spend,
            hasViewKey: !!wallet.keys?.priv?.view,
            spendKey: wallet.keys?.priv?.spend,
            viewKey: wallet.keys?.priv?.view
          });
          return wallet;
        } else {
          console.log('BIOMETRIC: Wallet decryption failed');
          return null;
        }
      } else {
        console.log('BIOMETRIC: Authentication failed');
        return null;
      }
    } catch (error) {
      console.error('BIOMETRIC: Error in biometric authentication:', error);
      return null;
    }
  }

  private static async authenticateWithPassword(): Promise<Wallet | null> {
    try {
      console.log('PASSWORD: Starting password authentication...');
      
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
        console.log('PASSWORD: No password provided');
        return null;
      }
      
      console.log('PASSWORD: Password provided, verifying and decrypting wallet...');
      
      // First verify the password against stored hash and get the stored derived key
      const storedDerivedKey = await this.verifyPasswordAndGetKey(password);
      if (!storedDerivedKey) {
        console.log('PASSWORD: Password verification failed - invalid password');
        return null;
      }
      
      // Now decrypt the wallet using the stored derived key
      const wallet = await this.getDecryptedWalletWithDerivedKey(storedDerivedKey);
      if (wallet) {
        console.log('PASSWORD: Wallet decrypted successfully with stored derived key');
        console.log('PASSWORD: Wallet keys after decryption:', {
          hasSpendKey: !!wallet.keys?.priv?.spend,
          hasViewKey: !!wallet.keys?.priv?.view,
          spendKey: wallet.keys?.priv?.spend,
          viewKey: wallet.keys?.priv?.view
        });
        
        // Store the derived key for quiet saves during sync
        this.setCurrentSessionPasswordKey(storedDerivedKey);
        
        return wallet;
      } else {
        console.log('PASSWORD: Wallet decryption failed with stored derived key');
        return null;
      }
    } catch (error) {
      console.error('PASSWORD: Error in password authentication:', error);
      return null;
    }
  }

  static async clearWallet(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(this.WALLET_KEY);
        localStorage.removeItem(this.ENCRYPTION_KEY);
        localStorage.removeItem(this.WALLET_HAS_PASSWORD_KEY);
        localStorage.removeItem(this.BIOMETRIC_SALT_KEY);
        localStorage.removeItem(this.PASSWORD_DERIVED_KEY);
        localStorage.removeItem(this.PASSWORD_HASH_KEY);
      } else {
        await AsyncStorage.removeItem(this.WALLET_KEY);
        await SecureStore.deleteItemAsync(this.ENCRYPTION_KEY);
        await SecureStore.deleteItemAsync(this.WALLET_HAS_PASSWORD_KEY);
        await SecureStore.deleteItemAsync(this.BIOMETRIC_SALT_KEY);
        await SecureStore.deleteItemAsync(this.PASSWORD_DERIVED_KEY);
        await SecureStore.deleteItemAsync(this.PASSWORD_HASH_KEY);
      }
    } catch (error) {
      console.error('Error clearing wallet:', error);
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
        const biometricKey = await this.deriveBiometricKey();
        if (!biometricKey) {
          throw new Error('Failed to derive biometric key');
        }
        encryptionKey = biometricKey;
        console.log('BIOMETRIC: Encrypting with derived biometric key');
      } else {
        // Password mode: derive password key
        encryptionKey = await this.derivePasswordKey(password);
        console.log('PASSWORD: Encrypting with derived password key');
      }
      
      // Always encrypt with derived key, never human password
      const encryptedWallet = WalletRepository.save(wallet, encryptionKey);
      await this.saveEncryptedWalletData(encryptedWallet);
      await SecureStore.setItemAsync(this.WALLET_HAS_PASSWORD_KEY, 'true');
    } catch (error) {
      console.error('Error saving encrypted wallet:', error);
      throw new Error('Failed to save encrypted wallet');
    }
  }

  /**
   * New method for password mode with persistent derived keys
   */
  static async saveEncryptedWalletWithPersistentKey(wallet: Wallet, password: string): Promise<void> {
    try {
      // Derive the key and encrypt with it
      const derivedKey = await this.derivePasswordKey(password);
      const encryptedWallet = WalletRepository.save(wallet, derivedKey);
      await this.saveEncryptedWalletData(encryptedWallet);
      
      // Store the persistent derived key and password hash
      await this.storePersistentPasswordKey(password);
      
      // Set the password flag
      await SecureStore.setItemAsync(this.WALLET_HAS_PASSWORD_KEY, 'true');
      console.log('PASSWORD: Wallet encrypted with persistent derived key');
    } catch (error) {
      console.error('Error saving encrypted wallet with persistent key:', error);
      throw new Error('Failed to save encrypted wallet with persistent key');
    }
  }

  static async getEncryptedWallet(password: string): Promise<Wallet | null> {
    try {
      const walletData = await this.getWallet();
      return WalletRepository.getLocalWalletWithPassword(password, walletData);
    } catch (error) {
      console.error('Error getting encrypted wallet:', error);
      return null;
    }
  }

  static async getDecryptedWalletWithPassword(password: string): Promise<Wallet | null> {
    try {
      // Get raw encrypted data directly, bypassing authentication
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(this.WALLET_KEY);
      } else {
        data = await AsyncStorage.getItem(this.WALLET_KEY);
      }
      
      if (!data) return null;
      
      const parsedData = JSON.parse(data);
      
      // Check if this is encrypted data (has 'data' and 'nonce' properties)
      if (parsedData.data && parsedData.nonce) {
        // Directly decrypt with provided password
        return WalletRepository.decodeWithPassword(parsedData, password);
      }
      
      // Unencrypted data is not allowed - this is a security violation
      console.error('SECURITY VIOLATION: Found unencrypted wallet data in getDecryptedWalletWithPassword!');
      return null;
    } catch (error) {
      console.error('Error getting decrypted wallet with password:', error);
      return null;
    }
  }

  static async getDecryptedWalletWithDerivedKey(derivedKey: string): Promise<Wallet | null> {
    try {
      // Get raw encrypted data directly
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(this.WALLET_KEY);
      } else {
        data = await AsyncStorage.getItem(this.WALLET_KEY);
      }
      
      if (!data) return null;
      
      const parsedData = JSON.parse(data);
      
      // Check if this is encrypted data (has 'data' and 'nonce' properties)
      if (parsedData.data && parsedData.nonce) {
        // Decrypt with the stored derived key
        return WalletRepository.decodeWithPassword(parsedData, derivedKey);
      }
      
      // Unencrypted data is not allowed - this is a security violation
      console.error('SECURITY VIOLATION: Found unencrypted wallet data in getDecryptedWalletWithDerivedKey!');
      return null;
    } catch (error) {
      console.error('Error getting decrypted wallet with derived key:', error);
      return null;
    }
  }

  static async getDecryptedWalletWithBiometric(): Promise<Wallet | null> {
    try {
      // Get raw encrypted data directly
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(this.WALLET_KEY);
      } else {
        data = await AsyncStorage.getItem(this.WALLET_KEY);
      }
      
      if (!data) return null;
      
      const parsedData = JSON.parse(data);
      
      // Check if this is encrypted data (has 'data' and 'nonce' properties)
      if (parsedData.data && parsedData.nonce) {
        // Derive biometric key from device capabilities + salt
        const biometricKey = await this.deriveBiometricKey();
        if (!biometricKey) {
          return null;
        }
        
        // Decrypt with derived biometric key
        console.log('BIOMETRIC DECRYPT: Attempting to decrypt with derived key...');
        try {
          const result = WalletRepository.decodeWithPassword(parsedData, biometricKey);
          console.log('BIOMETRIC DECRYPT: Decryption successful:', !!result);
          return result;
        } catch (error) {
          console.log('BIOMETRIC DECRYPT: Decryption failed:', error.message);
          return null;
        }
      }
      
      // Unencrypted data is not allowed - this is a security violation
      console.error('SECURITY VIOLATION: Found unencrypted wallet data in getDecryptedWalletWithBiometric!');
      return null;
    } catch (error) {
      console.error('Error getting decrypted wallet with biometric:', error);
      return null;
    }
  }

  static async hasAnyWalletData(): Promise<boolean> {
    try {
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(this.WALLET_KEY);
      } else {
        data = await AsyncStorage.getItem(this.WALLET_KEY);
      }
      
      // Return true if any data exists (encrypted or not)
      return data !== null;
    } catch (error) {
      console.error('Error checking for wallet data:', error);
      return false;
    }
  }

  // Biometric authentication methods
  static async isBiometricAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }


  static async walletHasPassword(): Promise<boolean> {
    try {
      const hasPassword = await SecureStore.getItemAsync(this.WALLET_HAS_PASSWORD_KEY);
      return hasPassword === 'true';
    } catch (error) {
      console.error('Error checking wallet password status:', error);
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
        const wallet = await this.getWallet();
        if (wallet) {
          return wallet;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting wallet with biometric:', error);
      return null;
    }
  }

  static async authenticateAndGetWallet(): Promise<Wallet | null> {
    try {
      const isBiometricEnabled = await BiometricService.isBiometricEnabled();
      
      if (isBiometricEnabled) {
        // Try biometric first
        const wallet = await this.getWalletWithBiometric();
        if (wallet) {
          return wallet;
        }
        // Biometric failed, fallback to password
      }
      
      // Require password authentication
      return new Promise((resolve) => {
        Alert.prompt(
          'Wallet Password',
          'Enter your wallet password:',
          [
            {
              text: 'Cancel',
              onPress: () => resolve(null),
              style: 'cancel',
            },
            {
              text: 'Unlock',
              onPress: async (password) => {
                if (!password) {
                  Alert.alert('Error', 'Password is required');
                  resolve(null);
                  return;
                }
                
                const wallet = await this.getEncryptedWallet(password);
                resolve(wallet);
              },
            },
          ],
          'secure-text'
        );
      });
    } catch (error) {
      console.error('Error in authentication:', error);
      return null;
    }
  }


  // New biometric salt methods
  static async generateAndStoreBiometricSalt(userPassword: string): Promise<void> {
    try {
      // Generate a salt derived from the user password
      const salt = await this.deriveSaltFromPassword(userPassword);
      await SecureStore.setItemAsync(this.BIOMETRIC_SALT_KEY, salt);
    } catch (error) {
      console.error('Error generating biometric salt:', error);
      throw new Error('Failed to generate biometric salt');
    }
  }

  static async getBiometricSalt(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(this.BIOMETRIC_SALT_KEY);
    } catch (error) {
      console.error('Error getting biometric salt:', error);
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
      console.log('BIOMETRIC KEY: Starting key derivation...');
      const salt = await this.getBiometricSalt();
      console.log('BIOMETRIC KEY: Salt available:', !!salt);
      if (!salt) {
        console.log('BIOMETRIC KEY: No salt found');
        return null;
      }
      
      // Generate a consistent biometric identifier based on device capabilities
      // This creates a unique key per device/user combination
      const biometricIdentifier = await this.generateBiometricIdentifier();
      console.log('BIOMETRIC KEY: Generated biometric identifier');
      
      // Derive key from biometric identifier + salt using expo-crypto
      const data = biometricIdentifier + salt;
      const key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
      console.log('BIOMETRIC KEY: Key derived successfully');
      return key;
    } catch (error) {
      console.error('BIOMETRIC KEY: Error deriving biometric key:', error);
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
        deviceConstant: 'conceal_wallet_biometric'
      };
      
      const identifierString = JSON.stringify(deviceInfo);
      return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, identifierString);
    } catch (error) {
      console.error('Error generating biometric identifier:', error);
      // Fallback to a simple identifier
      return 'fallback_biometric_identifier';
    }
  }

  private static async promptForPassword(message: string): Promise<string | null> {
    return new Promise((resolve) => {
      Alert.prompt(
        'Wallet Password Required',
        message,
        [
          {
            text: 'Cancel',
            onPress: () => resolve(null),
            style: 'cancel',
          },
          {
            text: 'Unlock',
            onPress: (password) => {
              if (!password) {
                resolve(null);
              } else {
                resolve(password);
              }
            },
          },
        ],
        'secure-text'
      );
    });
  }

  // Custom Node Management Methods
  static async getCustomNode(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(this.CUSTOM_NODE_KEY);
    } catch (error) {
      console.error('Error getting custom node:', error);
      return null;
    }
  }

  static async setCustomNode(nodeUrl: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(this.CUSTOM_NODE_KEY, nodeUrl);
      console.log('Custom node saved:', nodeUrl);
      return true;
    } catch (error) {
      console.error('Error saving custom node:', error);
      return false;
    }
  }

  static async clearCustomNode(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(this.CUSTOM_NODE_KEY);
      console.log('Custom node cleared, reverting to default');
      return true;
    } catch (error) {
      console.error('Error clearing custom node:', error);
      return false;
    }
  }

  /**
   * Store the current session's password key for quiet saves during sync
   * This is called after successful password authentication
   */
  static setCurrentSessionPasswordKey(passwordKey: string): void {
    this.currentSessionPasswordKey = passwordKey;
    console.log('PASSWORD KEY: Stored current session password key for quiet saves');
  }

  /**
   * Get the current session's password key for quiet saves
   * Returns null if no key is stored (user not authenticated or biometric mode)
   */
  static getStoredPasswordKey(): string | null {
    return this.currentSessionPasswordKey;
  }

  /**
   * Clear the current session's password key (called on logout/app restart)
   */
  static clearCurrentSessionPasswordKey(): void {
    this.currentSessionPasswordKey = null;
    console.log('PASSWORD KEY: Cleared current session password key');
  }

  /**
   * Store the persistent derived password key and password hash
   * This is called when setting up password mode
   */
  static async storePersistentPasswordKey(password: string): Promise<void> {
    try {
      const derivedKey = await this.derivePasswordKey(password);
      const passwordHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
      
      await SecureStore.setItemAsync(this.PASSWORD_DERIVED_KEY, derivedKey);
      await SecureStore.setItemAsync(this.PASSWORD_HASH_KEY, passwordHash);
      
      console.log('PASSWORD KEY: Stored persistent derived key and password hash');
    } catch (error) {
      console.error('PASSWORD KEY: Error storing persistent key:', error);
      throw error;
    }
  }

  /**
   * Verify password against stored hash and return stored derived key
   * Returns null if password is invalid
   */
  static async verifyPasswordAndGetKey(password: string): Promise<string | null> {
    try {
      const storedHash = await SecureStore.getItemAsync(this.PASSWORD_HASH_KEY);
      const storedKey = await SecureStore.getItemAsync(this.PASSWORD_DERIVED_KEY);
      
      if (!storedHash || !storedKey) {
        console.log('PASSWORD KEY: No stored password data found');
        return null;
      }
      
      const passwordHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
      
      if (passwordHash !== storedHash) {
        console.log('PASSWORD KEY: Password hash mismatch - invalid password');
        return null;
      }
      
      console.log('PASSWORD KEY: Password verified, returning stored derived key');
      return storedKey;
    } catch (error) {
      console.error('PASSWORD KEY: Error verifying password:', error);
      return null;
    }
  }

  /**
   * Clear persistent password data
   */
  static async clearPersistentPasswordData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.PASSWORD_DERIVED_KEY);
      await SecureStore.deleteItemAsync(this.PASSWORD_HASH_KEY);
      console.log('PASSWORD KEY: Cleared persistent password data');
    } catch (error) {
      console.error('PASSWORD KEY: Error clearing persistent data:', error);
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
    return Array.from(privKey).map(b => b.toString(16).padStart(2, '0')).join('');
  }

} 