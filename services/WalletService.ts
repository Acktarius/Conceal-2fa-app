/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Alert, BackHandler, Platform } from 'react-native';
import { config, logDebugMsg } from '../config';
import { JSBigInt } from '../lib/biginteger';
import { BlockchainExplorerRpcDaemon } from '../model/blockchain/BlockchainExplorerRPCDaemon';
import { Cn, CnNativeBride, CnRandom } from '../model/Cn';
import { KeysRepository } from '../model/KeysRepository';
import { SmartMessageParser } from '../model/SmartMessage';
import { SharedKey } from '../model/Transaction';
import { TransactionsExplorer } from '../model/TransactionsExplorer';
import { RawWallet, Wallet } from '../model/Wallet';
import { WalletRepository } from '../model/WalletRepository';
import { WalletWatchdogRN } from '../model/WalletWatchdogRN';
import { BiometricService } from './BiometricService';
import { dependencyContainer } from './DependencyContainer';
import { ImportService } from './ImportService';
import type { IWalletOperations } from './interfaces/IWalletOperations';
import { getGlobalWorkletLogging } from './interfaces/IWorkletLogging';
import { WalletStorageManager } from './WalletStorageManager';

export class WalletService implements IWalletOperations {
  private static readonly ENCRYPTION_KEY = 'wallet_encryption_key';
  private static wallet: Wallet | null = null;
  private static blockchainExplorer: BlockchainExplorerRpcDaemon | null = null;
  private static walletWatchdog: WalletWatchdogRN | null = null;

  // Session flags (loaded from storage)
  private static flag_prompt_main_tab = false;
  private static flag_prompt_wallet_tab = false;

  // Global callback for balance refresh (pragmatic approach)
  private static balanceRefreshCallback: (() => void) | null = null;

  // Global callback for shared keys refresh (pragmatic approach)
  private static sharedKeysRefreshCallback: (() => void) | null = null;

  // Register this service in the dependency container
  static registerInContainer(): void {
    dependencyContainer.registerWalletOperations(new WalletService());
  }

  // Load upgrade prompt flags from storage
  private static async loadUpgradeFlags(): Promise<void> {
    try {
      const storageService = dependencyContainer.getStorageService();
      const settings = await storageService.getSettings();
      WalletService.flag_prompt_main_tab = settings.flag_prompt_main_tab || false;
      WalletService.flag_prompt_wallet_tab = settings.flag_prompt_wallet_tab || false;
    } catch (error) {
      console.error('Error loading upgrade flags:', error);
      // Keep defaults (false) if loading fails
    }
  }

  // Save upgrade prompt flags to storage
  private static async saveUpgradeFlags(): Promise<void> {
    try {
      const storageService = dependencyContainer.getStorageService();
      const settings = await storageService.getSettings();
      await storageService.saveSettings({
        ...settings,
        flag_prompt_main_tab: WalletService.flag_prompt_main_tab,
        flag_prompt_wallet_tab: WalletService.flag_prompt_wallet_tab,
      });
    } catch (error) {
      console.error('Error saving upgrade flags:', error);
    }
  }

  // Instance methods that delegate to static methods (for interface compliance)
  async saveWallet(reason?: string): Promise<void> {
    return WalletService.saveWallet(reason);
  }

  getWalletSyncStatus(): any {
    return WalletService.getWalletSyncStatus();
  }

  async signalWalletUpdate(): Promise<void> {
    return WalletService.signalWalletUpdate();
  }

  async triggerManualSave(): Promise<void> {
    return WalletService.triggerManualSave();
  }

  async reinitializeBlockchainExplorer(): Promise<void> {
    return WalletService.reinitializeBlockchainExplorer();
  }

  getCurrentSessionNodeUrl(): string | null {
    return WalletService.getCurrentSessionNodeUrl();
  }

  static hasActiveWallet(): boolean {
    return WalletService.wallet !== null;
  }

  static getCachedWallet(): Wallet | null {
    return WalletService.wallet;
  }

  // Pragmatic approach: Register a callback for balance refresh
  static registerBalanceRefreshCallback(callback: () => void): void {
    WalletService.balanceRefreshCallback = callback;
  }

  // Pragmatic approach: Trigger balance refresh directly
  static triggerBalanceRefresh(): void {
    if (WalletService.balanceRefreshCallback) {
      WalletService.balanceRefreshCallback();
    } else {
      getGlobalWorkletLogging().logging1string('WalletService: No balance refresh callback registered');
    }
  }

  // Pragmatic approach: Register a callback for shared keys refresh
  static registerSharedKeysRefreshCallback(callback: () => void): void {
    WalletService.sharedKeysRefreshCallback = callback;
  }

  // Pragmatic approach: Trigger shared keys refresh directly
  static triggerSharedKeysRefresh(): void {
    if (WalletService.sharedKeysRefreshCallback) {
      WalletService.sharedKeysRefreshCallback();
    } else {
      getGlobalWorkletLogging().logging1string('WalletService: No shared keys refresh callback registered');
    }
  }

  // Global janitor function - call this after processing transactions
  static async janitor(): Promise<void> {
    try {
      getGlobalWorkletLogging().logging1string('WalletService: janitor() called - performing maintenance');
      //console.log('WalletService: janitor() called - performing maintenance');

      // 1. Save wallet to storage (persist any changes)
      await WalletService.saveWallet('janitor maintenance');

      // 2. Trigger balance refresh directly
      WalletService.triggerBalanceRefresh();

      // 3. Trigger shared keys refresh (for smart message updates)
      WalletService.triggerSharedKeysRefresh();

      getGlobalWorkletLogging().logging1string('WalletService: janitor() completed');
    } catch (error) {
      console.error('WalletService: Error in janitor():', error);
    }
  }

  // Instance method for IWalletOperations interface
  async janitor(): Promise<void> {
    return WalletService.janitor();
  }

  // Instance method for IWalletOperations interface
  triggerBalanceRefresh(): void {
    return WalletService.triggerBalanceRefresh();
  }

  // Instance method for IWalletOperations interface
  triggerSharedKeysRefresh(): void {
    return WalletService.triggerSharedKeysRefresh();
  }

  // Instance method for IWalletOperations interface
  async sendSmartMessage(
    action: 'create' | 'delete',
    sharedKey: any,
    paymentId?: string
  ): Promise<{ success: boolean; txHash?: string }> {
    return WalletService.sendSmartMessage(action, sharedKey, paymentId);
  }

  // Instance method for IWalletOperations interface
  getWalletBalance(): number {
    return WalletService.wallet?.amount || 0;
  }

  // Instance method for IWalletOperations interface
  async isWalletLocal(): Promise<boolean> {
    // Ensure wallet is loaded
    if (!WalletService.wallet) {
      // Try to get wallet from storage if not cached
      try {
        const wallet = await WalletStorageManager.getWallet();
        if (wallet) {
          WalletService.wallet = wallet;
        }
      } catch (error) {
        console.error('WalletService: Error loading wallet in isWalletLocal():', error);
      }
    }

    if (WalletService.wallet) {
      return WalletService.wallet.isLocal();
    }
    // If no wallet available, assume it's local to be safe
    return true;
  }

  private static async hasAnyWalletData(): Promise<boolean> {
    try {
      // Use WalletStorageManager to check if wallet data exists
      return await WalletStorageManager.hasAnyWalletData();
    } catch (error) {
      console.error('Error checking for wallet data:', error);
      return false;
    }
  }

  static async authenticateUser(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        throw new Error('Biometric hardware not available');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use passcode',
      });

      return result.success;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }

  private static async encryptData(data: any): Promise<string> {
    const jsonData = JSON.stringify(data);
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      jsonData + WalletService.ENCRYPTION_KEY
    );
    return digest;
  }

  private static async decryptData(encryptedData: string): Promise<any> {
    try {
      const data = JSON.parse(encryptedData);
      return data;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt wallet data');
    }
  }

  static async reinitializeBlockchainExplorer(): Promise<void> {
    try {
      if (WalletService.blockchainExplorer) {
        // Reset nodes to pick up custom node changes (like WebWallet does)
        await WalletService.blockchainExplorer.resetNodes();
        getGlobalWorkletLogging().logging1string(
          'WALLET SERVICE: Blockchain explorer nodes reset for custom node changes'
        );
      }
    } catch (error) {
      console.error('WALLET SERVICE: Error resetting blockchain explorer nodes:', error);
    }
  }

  static getCurrentSessionNodeUrl(): string | null {
    try {
      if (WalletService.blockchainExplorer) {
        return WalletService.blockchainExplorer.getCurrentSessionNodeUrl();
      }
      return null;
    } catch (error) {
      console.error('WALLET SERVICE: Error getting current session node URL:', error);
      return null;
    }
  }

  static async getOrCreateWallet(callerScreen?: 'home' | 'wallet'): Promise<Wallet> {
    try {
      // Load upgrade prompt flags from storage
      await WalletService.loadUpgradeFlags();

      // Initialize blockchain explorer if not already done
      if (!WalletService.blockchainExplorer) {
        WalletService.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await WalletService.blockchainExplorer.initialize();
      }

      // Use already loaded wallet if available, otherwise load it
      let wallet = WalletService.wallet || (await WalletStorageManager.getWallet());

      // If no wallet exists at all, create a local-only wallet first
      // BUT: If this is due to authentication failure, we should NOT create a new wallet
      // as this would overwrite the existing blockchain wallet
      if (!wallet) {
        getGlobalWorkletLogging().logging1string(
          'WALLET SERVICE: No wallet loaded - checking if this is a new user or auth failure...'
        );
        //console.log('WALLET SERVICE: No wallet loaded - checking if this is a new user or auth failure...');

        // Check if this is a new user (no data) vs auth failure (data exists but can't decrypt)
        const hasAnyWalletData = await WalletService.hasAnyWalletData();
        if (hasAnyWalletData) {
          getGlobalWorkletLogging().logging1string(
            'WALLET SERVICE: Wallet data exists but authentication failed - EXITING APP for security'
          );
          //console.log('WALLET SERVICE: Wallet data exists but authentication failed - EXITING APP for security');
          // Exit app immediately - authentication failure
          if (Platform.OS === 'android') {
            BackHandler.exitApp();
          } else {
            // iOS doesn't allow programmatic exit
            Alert.alert('Authentication Failed', 'Unable to access wallet. Please restart the app.', [
              { text: 'OK', onPress: () => {} },
            ]);
          }
          throw new Error('Authentication failed - app exiting');
        }
        getGlobalWorkletLogging().logging1string(
          'WALLET SERVICE: No wallet data exists - creating new local wallet for new user'
        );
        //console.log('WALLET SERVICE: No wallet data exists - creating new local wallet for new user');
        wallet = await WalletService.createLocalWallet();
      }

      // Set the wallet instance for future calls
      WalletService.wallet = wallet;

      // If wallet exists but is local-only (no keys), check flags and show prompt
      if (wallet && wallet.isLocal()) {
        // Only show prompt if not prompted before
        if (!WalletService.flag_prompt_main_tab || !WalletService.flag_prompt_wallet_tab) {
          const result = await new Promise<'create' | 'import' | 'cancel'>((resolve) => {
            Alert.alert(
              'Upgrade Wallet',
              'Your wallet is currently local-only. Would you like to upgrade it to blockchain-compatible or import an existing one?',
              [
                {
                  text: 'Upgrade to Blockchain',
                  onPress: () => resolve('create'),
                },
                {
                  text: 'Import Existing',
                  onPress: () => resolve('import'),
                },
                {
                  text: 'Stay Local',
                  onPress: () => resolve('cancel'),
                  style: 'cancel',
                },
              ],
              { cancelable: true }
            );
          });

          // Set flag based on calling screen and save to storage
          if (callerScreen === 'home') {
            WalletService.flag_prompt_main_tab = true;
          } else if (callerScreen === 'wallet') {
            WalletService.flag_prompt_wallet_tab = true;
          }

          // Save flags to storage
          await WalletService.saveUpgradeFlags();

          //getGlobalWorkletLogging().logging2string('WALLET SERVICE: User choice:', result);
          //console.log('WALLET SERVICE: User choice:', result);

          if (result === 'cancel') {
            return wallet;
          }

          if (result === 'import') {
            wallet = await ImportService.importWallet();
            // Update cached instance with the imported wallet
            WalletService.wallet = wallet;
          } else {
            wallet = await WalletService.upgradeToBlockchainWallet();
            // Update cached instance with the upgraded wallet
            WalletService.wallet = wallet;
          }
        }
      }

      return wallet;
    } catch (error) {
      console.error('Error getting/creating wallet:', error);
      console.error('Wallet initialization error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw new Error(`Failed to initialize wallet: ${error.message}`);
    }
  }

  static async createLocalWallet(): Promise<Wallet> {
    try {
      // Create a minimal local-only wallet with no blockchain data
      const wallet = new Wallet();
      wallet.keys = KeysRepository.createEmptyKeys(); // This makes it local-only
      wallet.creationHeight = null;

      if (await BiometricService.isBiometricEnabled()) {
        // Biometric mode: Encrypt with biometric key
        // Generate cryptographically secure biometric salt
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        const randomSalt = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          'biometric_salt_' + Date.now() + Array.from(randomBytes).join('')
        );
        await WalletStorageManager.generateAndStoreBiometricSalt(randomSalt);

        // THEN derive the biometric key
        const biometricKey = await WalletStorageManager.deriveBiometricKey();
        if (!biometricKey) {
          throw new Error('Failed to generate biometric key for local wallet encryption');
        }
        await WalletStorageManager.saveEncryptedWallet(wallet, biometricKey);
      } else {
        // Password mode: Use PasswordCreationAlert for proper password creation
        const password = await WalletService.promptForPasswordCreation(
          'Create a password to secure your local wallet:'
        );
        if (!password) {
          throw new Error('Password required to create local wallet');
        }
        await WalletStorageManager.saveEncryptedWallet(wallet, password);

        // Generate biometric salt from user password (for future biometric enablement)
        await WalletStorageManager.generateAndStoreBiometricSalt(password);
      }

      return wallet;
    } catch (error) {
      console.error('Error creating local wallet:', error);
      throw new Error('Failed to create local wallet');
    }
  }

  static async promptForPassword(message: string): Promise<string | null> {
    // Get the password prompt context from global state
    const passwordPromptContext = (global as any).passwordPromptContext;

    if (!passwordPromptContext) {
      throw new Error('Password prompt context not available. App must be properly initialized.');
    }

    const result = await passwordPromptContext.showPasswordPromptAlert('Wallet Password Required', message);
    return result;
  }

  static async promptForPasswordCreation(message: string): Promise<string | null> {
    // Get the password prompt context from global state
    const passwordPromptContext = (global as any).passwordPromptContext;

    if (!passwordPromptContext) {
      throw new Error('Password prompt context not available. App must be properly initialized.');
    }

    const result = await passwordPromptContext.showPasswordCreationAlert('Create Wallet Password', message);
    return result;
  }

  static async upgradeToBlockchainWallet(): Promise<Wallet> {
    try {
      // Get the existing local wallet from storage
      const existingWallet = await WalletStorageManager.getWallet();
      if (!existingWallet) {
        throw new Error('No existing wallet found to upgrade');
      }

      let password: string | null = null;

      if (await BiometricService.isBiometricChecked()) {
        // Biometric-first approach: use biometric for wallet upgrade
        // We'll encrypt with biometric key after upgrade
      } else {
        // Fallback to password if biometric not available
        password = await WalletService.promptForPassword('Enter a password to secure your upgraded wallet:');
        if (!password) {
          return existingWallet;
        }
      }

      // Generate random seed using Cn functions - this works offline
      const seed = CnNativeBride.sc_reduce32(CnRandom.rand_32());

      // Create address and keys using Cn functions - this works offline
      const keys = Cn.create_address(seed);

      // Set initial creation height
      // If offline, we'll start from 0 and sync later
      let creationHeight = 0;

      // Try to get blockchain height if possible, but don't block on it
      try {
        if (!WalletService.blockchainExplorer) {
          WalletService.blockchainExplorer = new BlockchainExplorerRpcDaemon();

          await Promise.race([
            WalletService.blockchainExplorer.initialize(),
            new Promise((_, reject) => setTimeout(() => reject('TIMEOUT'), 5000)),
          ]);

          const currentHeight = await Promise.race([
            WalletService.blockchainExplorer.getHeight(),
            new Promise<number>((_, reject) => setTimeout(() => reject('TIMEOUT'), 5000)),
          ]);

          creationHeight = Math.max(0, currentHeight - 10);
        }
      } catch (error) {
        console.log('UPGRADE: Failed to get blockchain height, using creationHeight = 0:', error);
        // We'll continue with creationHeight = 0
      }

      // Upgrade the existing wallet with blockchain data
      const wallet = existingWallet;
      wallet.keys = KeysRepository.fromPriv(keys.spend.sec, keys.view.sec);
      wallet.creationHeight = creationHeight;

      // Save the upgraded wallet with appropriate encryption
      if (await BiometricService.isBiometricChecked()) {
        // Encrypt with biometric key
        // Use existing biometric salt (don't generate new one for upgrade)
        const biometricKey = await WalletStorageManager.deriveBiometricKey();
        if (!biometricKey) {
          throw new Error('Failed to generate biometric key for wallet encryption');
        }
        await WalletStorageManager.saveEncryptedWallet(wallet, biometricKey);
      } else {
        // Encrypt with user password
        await WalletStorageManager.saveEncryptedWallet(wallet, password!);

        // Generate biometric salt from user password (for future biometric mode switching)
        await WalletStorageManager.generateAndStoreBiometricSalt(password!);
      }

      // Set the wallet instance
      WalletService.wallet = wallet;

      // Start wallet synchronization after upgrade
      try {
        await WalletService.startWalletSynchronization();
      } catch (error) {
        console.error('WALLET SERVICE: Error starting synchronization after upgrade:', error);
        // Continue without synchronization for now
      }

      return wallet;
    } catch (error) {
      console.error('Error upgrading wallet:', error);
      console.error('Wallet upgrade error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw new Error(`Failed to upgrade wallet: ${error.message}`);
    }
  }

  static async addSharedKey(serviceData: { name: string; issuer: string; secret: string }): Promise<void> {
    if (!WalletService.wallet) {
      throw new Error('Wallet not initialized');
    }

    const sharedKey = SharedKey.fromRaw(serviceData);

    // Add to blockchain compatible transactions
    WalletService.wallet.addNew(sharedKey, true);

    // Save wallet state
    await WalletService.saveWalletState();
  }

  static async removeSharedKey(hash: string): Promise<void> {
    if (!WalletService.wallet) {
      throw new Error('Wallet not initialized');
    }

    const isAuthenticated = await WalletService.authenticateUser();
    if (!isAuthenticated) {
      throw new Error('Authentication failed');
    }

    // Use wallet's methods to handle transactions
    const tx = WalletService.wallet.findWithTxHash(hash);
    if (tx) {
      WalletService.wallet.clearTransactions(); // Clear all and rebuild without the removed key
      await WalletService.saveWalletState();
    }
  }

  private static async saveWalletState(): Promise<void> {
    if (!WalletService.wallet) return;

    // Get the current authentication mode to determine encryption key
    const isBiometricEnabled = await BiometricService.isBiometricEnabled();

    if (isBiometricEnabled) {
      // Use biometric key for encryption
      const biometricKey = await WalletStorageManager.deriveBiometricKey();
      if (biometricKey) {
        await WalletStorageManager.saveEncryptedWallet(WalletService.wallet, biometricKey);
      }
    } else {
      // Password mode: We need the user's password to re-encrypt
      // This is a limitation - we can't save wallet state changes without user interaction
      console.warn('WARNING: Cannot save wallet state in password mode without user password');
      console.warn('WARNING: Wallet state changes will be lost until next authentication');
    }
  }

  /**
   * Cleans up blockchain connection resources when the wallet session ends.
   * This does NOT delete the wallet data - it only:
   * 1. Stops wallet synchronization
   * 2. Stops active node connections
   * 3. Cleans up the blockchain monitoring session
   * 4. Releases memory resources
   *
   * Call this when:
   * - User logs out
   * - App goes to background
   * - Wallet component unmounts
   */
  static async cleanupWallet(): Promise<void> {
    // Stop wallet synchronization
    WalletService.stopWalletSynchronization();

    if (WalletService.blockchainExplorer) {
      WalletService.blockchainExplorer.cleanupSession();
    }
    WalletService.wallet = null;
  }

  /**
   * Completely resets the wallet state, clearing all data and returning to initial state.
   * This is called when user clears all data.
   */
  static async resetWallet(): Promise<void> {
    // Stop wallet synchronization
    WalletService.stopWalletSynchronization();

    // Clear blockchain connections
    if (WalletService.blockchainExplorer) {
      WalletService.blockchainExplorer.cleanupSession();
      WalletService.blockchainExplorer = null;
    }

    // Clear wallet instance
    WalletService.wallet = null;

    // Clear all storage
    await WalletStorageManager.clearWallet();
  }

  /**
   * Force clear ALL data and restart from scratch
   * This is more aggressive than resetWallet
   */
  static async forceClearAll(): Promise<void> {
    try {
      // Stop wallet synchronization
      WalletService.stopWalletSynchronization();

      // Clear blockchain connections
      if (WalletService.blockchainExplorer) {
        WalletService.blockchainExplorer.cleanupSession();
        WalletService.blockchainExplorer = null;
      }

      // Clear wallet instance
      WalletService.wallet = null;

      // Clear all storage using StorageService
      const storageService = dependencyContainer.getStorageService();
      await storageService.clearAll();
    } catch (error) {
      console.error('Error in force clear all:', error);
      throw error;
    }
  }

  /**
   * TEMPORARY: Clear stored wallet for testing purposes
   * TODO: Remove this function after testing
   */

  static async clearStoredWalletForTesting(): Promise<void> {
    try {
      // 1. Clear all wallet data
      await WalletStorageManager.clearWallet();

      // 2. Clear custom node settings
      await WalletStorageManager.clearCustomNode();

      // 3. Reset all service flags
      WalletService.flag_prompt_main_tab = false;
      WalletService.flag_prompt_wallet_tab = false;
      WalletService.wallet = null;

      // 4. Reset biometric to default (enabled)
      const storageService = dependencyContainer.getStorageService();
      await storageService.saveSettings({
        biometricAuth: true, // Default to enabled
      });

      // 5. Clear any blockchain explorer state
      if (WalletService.blockchainExplorer) {
        WalletService.blockchainExplorer.cleanupSession();
      }

      // 6. Clear wallet watchdog
      if (WalletService.walletWatchdog) {
        WalletService.walletWatchdog.stop();
        WalletService.walletWatchdog = null;
      }
    } catch (error) {
      console.error('TESTING: Error during complete app reset:', error);
      throw error;
    }
  }

  /**
   * Reset upgrade prompt flags (called after clear data)
   */
  static async resetUpgradeFlags(): Promise<void> {
    WalletService.flag_prompt_main_tab = false;
    WalletService.flag_prompt_wallet_tab = false;
    WalletService.wallet = null; // Clear cached wallet instance

    // Save cleared flags to storage
    await WalletService.saveUpgradeFlags();
  }

  static async clearWalletAndCache(): Promise<void> {
    await WalletStorageManager.clearWallet();
    await WalletStorageManager.clearCustomNode();

    // Reset all service flags
    WalletService.flag_prompt_main_tab = false;
    WalletService.flag_prompt_wallet_tab = false;
    WalletService.wallet = null; // Clear cached instance
    const storageService = dependencyContainer.getStorageService();
    await storageService.saveSettings({
      biometricAuth: true, // Default to enabled
    });

    // Clear any blockchain explorer state
    if (WalletService.blockchainExplorer) {
      WalletService.blockchainExplorer.cleanupSession();
    }
    // Clear wallet watchdog
    if (WalletService.walletWatchdog) {
      WalletService.walletWatchdog.stop();
      WalletService.walletWatchdog = null;
    }
  }

  static async clearCachedWallet(): Promise<void> {
    WalletService.wallet = null; // Clear cached instance to force reload from storage
  }

  /**
   * Start wallet synchronization with blockchain
   */
  static async startWalletSynchronization(): Promise<void> {
    try {
      // Load wallet from storage if cached instance is null
      if (!WalletService.wallet) {
        WalletService.wallet = await WalletStorageManager.getWallet();
        if (!WalletService.wallet) {
          throw new Error('No wallet available for synchronization');
        }
      }

      if (!WalletService.blockchainExplorer) {
        WalletService.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await WalletService.blockchainExplorer.initialize();
      }

      // Create watchdog if not exists
      if (!WalletService.walletWatchdog) {
        WalletService.walletWatchdog = new WalletWatchdogRN(WalletService.wallet, WalletService.blockchainExplorer);
      }

      // Start synchronization
      WalletService.walletWatchdog.start();
    } catch (error) {
      console.error('WALLET SERVICE: Error starting wallet synchronization:', error);
      throw error;
    }
  }

  /**
   * Stop wallet synchronization
   */
  static stopWalletSynchronization(): void {
    if (WalletService.walletWatchdog) {
      WalletService.walletWatchdog.stop();
      WalletService.walletWatchdog = null;
    }
  }

  /**
   * Get wallet synchronization status
   */
  static getWalletSyncStatus(): any {
    if (WalletService.walletWatchdog && WalletService.wallet) {
      const lastBlockLoading = WalletService.walletWatchdog.getLastBlockLoading();
      const blockList = WalletService.walletWatchdog.getBlockList();
      const blockchainHeight = WalletService.walletWatchdog.getBlockchainHeight();

      return {
        isRunning: true,
        lastBlockLoading: lastBlockLoading,
        lastMaximumHeight: blockchainHeight,
        transactionsInQueue: blockList ? blockList.getTxQueue().getSize() : 0,
        //isWalletSynced: lastBlockLoading >= blockchainHeight - 1 // Allow 1 block tolerance
        isWalletSynced:
          blockchainHeight > 0 &&
          lastBlockLoading >= blockchainHeight &&
          WalletService.wallet.lastHeight >= blockchainHeight,
      };
    }
    return {
      isRunning: false,
      lastBlockLoading: 0,
      lastMaximumHeight: 0,
      transactionsInQueue: 0,
      isWalletSynced: false,
    };
  }

  static async triggerManualSave(): Promise<void> {
    await WalletService.saveWallet('manual save from UI');
  }

  /**
   * Improved saveWallet method - works in both biometric and password modes
   * Uses stored session keys for quiet saves without re-authentication
   */
  static async saveWallet(reason: string = 'manual save'): Promise<void> {
    try {
      if (!WalletService.wallet) {
        throw new Error('No wallet available to save');
      }

      // Get the current encryption key (user is already authenticated)
      let encryptionKey: string | null = null;

      if (await BiometricService.isBiometricEnabled()) {
        encryptionKey = await WalletStorageManager.deriveBiometricKey();
      } else {
        // For password mode, try to get the stored password key
        // If user is synchronizing, they MUST be authenticated
        encryptionKey = await WalletStorageManager.getStoredPasswordKey();

        if (!encryptionKey) {
          console.error('WalletService: User is synchronizing but no password key found - this should not happen!');
          console.error('WalletService: Continuing sync without backup (data loss risk)');
          return;
        }
      }

      if (encryptionKey) {
        // Encrypt and save directly (bypass saveEncryptedWallet to control flag setting)
        const encryptedWallet = WalletRepository.save(WalletService.wallet, encryptionKey);
        await WalletStorageManager.saveEncryptedWalletData(encryptedWallet);

        // Set flag only for password mode (not biometric)
        if (!(await BiometricService.isBiometricChecked())) {
          await SecureStore.setItemAsync('wallet_has_password', 'true');
        }
      }
    } catch (error) {
      console.error('WalletService: Error saving wallet:', error);
    }
  }

  /**
   * Manually trigger wallet upgrade (called from UI button)
   */
  static async triggerWalletUpgrade(): Promise<Wallet> {
    try {
      const result = await new Promise<'create' | 'import' | 'cancel'>((resolve) => {
        Alert.alert(
          'Upgrade Wallet',
          'Choose how you would like to upgrade your wallet:',
          [
            {
              text: 'Upgrade to Blockchain',
              onPress: () => resolve('create'),
            },
            {
              text: 'Import Existing',
              onPress: () => resolve('import'),
            },
            {
              text: 'Cancel',
              onPress: () => resolve('cancel'),
              style: 'cancel',
            },
          ],
          { cancelable: true }
        );
      });

      if (result === 'cancel') {
        return WalletService.wallet!; // Return current wallet without changes
      }
      if (result === 'import') {
        const importedWallet = await ImportService.importWallet();
        // Update cached instance with the imported wallet
        WalletService.wallet = importedWallet;
        return importedWallet;
      }
      return await WalletService.upgradeToBlockchainWallet();
    } catch (error) {
      console.error('Error triggering wallet upgrade:', error);
      throw error;
    }
  }

  // Signal wallet update to trigger watchdog rescan
  static async signalWalletUpdate(): Promise<void> {
    try {
      if (WalletService.walletWatchdog) {
        WalletService.walletWatchdog.signalWalletUpdate();
      }
    } catch (error) {
      console.error('WalletService: Error signaling wallet update:', error);
    }
  }

  /**
   * Broadcast 2FA code via auto-destruct message
   * @param recipientAddress - CCX address to send to
   * @param code - 2FA code to broadcast
   * @param serviceName - Name of the service
   * @param timeRemaining - Time remaining for current code
   * @param futureCode - Next 2FA code (optional)
   * @returns Promise resolving to boolean - true for success, false for error
   */
  static async broadcast(
    recipientAddress: string,
    code: string,
    serviceName: string,
    timeRemaining: number,
    futureCode?: string
  ): Promise<boolean> {
    try {
      // Validate wallet state
      if (!WalletService.wallet || WalletService.wallet.isLocal()) {
        throw new Error('Wallet must be blockchain-enabled to broadcast');
      }

      if (!WalletService.blockchainExplorer) {
        throw new Error('Blockchain explorer not initialized');
      }

      // Check if wallet is synced
      const syncStatus = WalletService.getWalletSyncStatus();
      if (!syncStatus.isWalletSynced) {
        throw new Error('Wallet must be synced to broadcast');
      }

      // Optimized: Get both height and fee address in one call (single node request)
      const prepTxInfo = await WalletService.blockchainExplorer.getPrepTxInfo();
      const blockchainHeight = prepTxInfo.height;
      const remoteFeeAddress = prepTxInfo.feeAddress;

      // Create message based on time remaining
      let message: string;
      const now = Math.floor(Date.now() / 1000);

      // Helper function to format timestamp to human-readable format
      const formatTimestamp = (timestamp: number): string => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      };

      if (timeRemaining <= 5) {
        // Code expires soon
        const expiryTime = now + 5;
        message = `**${serviceName}**, at ${formatTimestamp(expiryTime)}  \`${code}\``;
      } else {
        // Code has time remaining
        const expiryTime = now + timeRemaining;
        if (futureCode) {
          message = `**${serviceName}**, until ${formatTimestamp(expiryTime)}  \`${code}\`  next \`${futureCode}\``;
        } else {
          message = `**${serviceName}**, until ${formatTimestamp(expiryTime)}  \`${code}\``;
        }
      }

      const ttl = 1; // Minimum 1 minute

      // Create destination with message amount (following webWallet pattern)
      const amountToSend = config.messageTxAmount.toJSValue(); // Convert JSBigInt to number
      const mixinToSendWith = config.defaultMixin;

      const destination: any[] = [{ address: recipientAddress, amount: amountToSend }];

      if (remoteFeeAddress !== WalletService.wallet.getPublicAddress()) {
        if (remoteFeeAddress !== '') {
          destination.push({ address: remoteFeeAddress, amount: config.remoteNodeFee.toJSValue() });
        } else {
          destination.push({ address: config.donationAddress, amount: config.remoteNodeFee.toJSValue() });
        }
      }

      // Set up global logDebugMsg for TransactionsExplorer
      (global as any).logDebugMsg = logDebugMsg;

      // Create transaction
      const rawTxData = await TransactionsExplorer.createTx(
        destination,
        '',
        WalletService.wallet,
        blockchainHeight,
        (amounts: number[], numberOuts: number): Promise<any> => {
          return WalletService.blockchainExplorer!.getRandomOuts(amounts, numberOuts);
        },
        (amount: number, feesAmount: number): Promise<void> => {
          if (amount + feesAmount > WalletService.wallet!.availableAmount(blockchainHeight)) {
            throw new Error('Insufficient balance for transaction');
          }
          return Promise.resolve();
        },
        mixinToSendWith || 5,
        message,
        'chacha8',
        ttl,
        'regular',
        0
      );

      // Send transaction (following webWallet pattern)
      await WalletService.blockchainExplorer.sendRawTx(rawTxData.raw.raw);

      // Check if sendRawTx actually succeeded
      /*if (!sendResult || sendResult.status !== 'OK') {
        throw new Error(`Failed to send raw transaction: ${sendResult?.status || 'Unknown error'}`);
      }
      */

      // Save transaction private key
      WalletService.wallet.addTxPrivateKeyWithTxHash(rawTxData.raw.hash, rawTxData.raw.prvkey);

      // Force mempool check
      if (WalletService.walletWatchdog) {
        WalletService.walletWatchdog.checkMempool();
      }

      // Broadcast successful - return true
      return true;
    } catch (error) {
      console.error('WalletService: Error broadcasting code:', error);
      throw new Error(`Failed to broadcast code: ${error.message}`);
    }
  }

  /**
   * Send smart message to blockchain
   * @param action - Action to perform ('create' or 'delete')
   * @param paymentId - Payment ID to use for the transaction
   * @param sharedKey - SharedKey object to process
   * @returns Promise resolving to {success: boolean, txHash?: string}
   */
  static async sendSmartMessage(
    action: 'create' | 'delete',
    sharedKey: SharedKey,
    paymentId: string = ''
  ): Promise<{ success: boolean; txHash?: string }> {
    try {
      // Validate wallet state
      if (!WalletService.wallet || WalletService.wallet.isLocal()) {
        throw new Error('Wallet must be blockchain-enabled to send smart messages');
      }

      if (!WalletService.blockchainExplorer) {
        WalletService.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await WalletService.blockchainExplorer.initialize();
      }

      // Check if wallet is synced
      const syncStatus = WalletService.getWalletSyncStatus();
      if (!syncStatus.isWalletSynced) {
        throw new Error('Wallet must be synced to send smart messages');
      }

      // Calculate minimum balance needed: messageTxAmount + nodeFee + coinFee
      const minBalance = config.messageTxAmount.add(config.remoteNodeFee).add(config.coinFee);
      const walletAmountBigInt = new JSBigInt(WalletService.wallet.amount.toString());
      if (walletAmountBigInt.compare(minBalance) < 0) {
        throw new Error('Insufficient balance for smart message');
      }

      // Optimized: Get both height and fee address in one call (single node request)
      const prepTxInfo = await WalletService.blockchainExplorer.getPrepTxInfo();
      const blockchainHeight = prepTxInfo.height;
      const remoteFeeAddress = prepTxInfo.feeAddress;

      // Create smart message command using SmartMessageParser methods
      let smartMessageResult: any;

      if (action === 'create') {
        // Use SmartMessageParser.encode2FA() for encoding create command
        smartMessageResult = await SmartMessageParser.encode2FA(
          'c',
          sharedKey.name,
          sharedKey.issuer,
          sharedKey.secret
        );
      } else if (action === 'delete') {
        // Use SmartMessageParser.encode2FA() for encoding delete command
        if (!sharedKey.hash) {
          throw new Error('Cannot delete shared key without hash');
        }
        smartMessageResult = await SmartMessageParser.encode2FA('d', sharedKey.hash);
      } else {
        throw new Error(`Invalid smart message action: ${action}`);
      }

      // Check if smart message creation was successful
      if (!smartMessageResult.success) {
        throw new Error(`Smart message creation failed: ${smartMessageResult.message}`);
      }

      // Use the encoded message from the result
      const smartMessage = smartMessageResult.data;

      // Smart message specific parameters (following webWallet pattern)
      const amountToSend = config.messageTxAmount.toJSValue(); // Convert JSBigInt to number
      const destinationAddress = WalletService.wallet.getPublicAddress();
      const mixinToSendWith = config.defaultMixin;

      const destination: any[] = [{ address: destinationAddress, amount: amountToSend }];

      if (remoteFeeAddress !== WalletService.wallet.getPublicAddress()) {
        if (remoteFeeAddress !== '') {
          destination.push({ address: remoteFeeAddress, amount: config.remoteNodeFee.toJSValue() });
        } else {
          destination.push({ address: config.donationAddress, amount: config.remoteNodeFee.toJSValue() });
        }
      }

      // Set up global logDebugMsg for TransactionsExplorer
      (global as any).logDebugMsg = logDebugMsg;

      // Use whitelisted payment ID if available and no payment ID provided
      let finalPaymentId = paymentId;
      if (!paymentId) {
        try {
          const storageService = dependencyContainer.getStorageService();
          const settings = await storageService.getSettings();
          if (settings.paymentIdWhiteList && settings.paymentIdWhiteList.length > 0) {
            finalPaymentId = settings.paymentIdWhiteList[0];
          }
        } catch (error) {
          getGlobalWorkletLogging().logging1string(
            'WalletService: Could not get payment ID whitelist, using empty payment ID'
          );
          //console.log('WalletService: Could not get payment ID whitelist, using empty payment ID');
        }
      }

      // Create transaction (following webWallet pattern exactly)
      const rawTxData = await TransactionsExplorer.createTx(
        destination,
        finalPaymentId,
        WalletService.wallet,
        blockchainHeight,
        (amounts: number[], numberOuts: number): Promise<any> => {
          return WalletService.blockchainExplorer!.getRandomOuts(amounts, numberOuts);
        },
        (amount: number, feesAmount: number): Promise<void> => {
          if (amount + feesAmount > WalletService.wallet!.availableAmount(blockchainHeight)) {
            throw new Error('Insufficient balance for transaction');
          }
          return Promise.resolve();
        },
        mixinToSendWith || 5,
        smartMessage,
        'chacha12',
        0, // TTL
        'regular',
        0
      );

      // Send transaction (following webWallet pattern)
      await WalletService.blockchainExplorer.sendRawTx(rawTxData.raw.raw);

      // Save transaction private key (following webWallet pattern)
      WalletService.wallet.addTxPrivateKeyWithTxHash(rawTxData.raw.hash, rawTxData.raw.prvkey);

      // Update shared key with transaction hash ONLY after successful send
      if (action === 'create') {
        sharedKey.hash = rawTxData.raw.hash;
      }

      // Force mempool check (following webWallet pattern)
      if (WalletService.walletWatchdog) {
        WalletService.walletWatchdog.checkMempool();
      }

      return {
        success: true,
        txHash: rawTxData.raw.hash,
      };
    } catch (error) {
      console.error('WalletService: Error sending smart message:', error);

      // Provide user-friendly error messages
      let errorMessage = 'Failed to send smart message';

      if (error.message.includes('balance_too_low')) {
        errorMessage = 'Insufficient balance for smart message';
      } else if (error.message.includes('invalid')) {
        errorMessage = error.message;
      } else if (error.message.includes('Address')) {
        errorMessage = error.message;
      } else if (error.message.includes('Amount')) {
        errorMessage = error.message;
      } else {
        errorMessage = `Smart message failed: ${error.message}`;
      }

      return {
        success: false,
        txHash: undefined, // No hash since transaction wasn't sent successfully
      };
    }
  }

  /**
   * Send CCX transaction to recipient address
   * @param recipientAddress - CCX address to send to
   * @param amount - Amount to send in CCX
   * @param paymentId - Optional payment ID
   * @param message - Optional message
   * @returns Promise resolving to transaction hash
   */
  static async sendTransaction(
    recipientAddress: string,
    amount: number,
    paymentId: string = '',
    message: string = ''
  ): Promise<string> {
    try {
      // Validate inputs
      if (!recipientAddress || !recipientAddress.trim()) {
        throw new Error('Recipient address is required');
      }

      if (!recipientAddress.startsWith('ccx7') || recipientAddress.length !== 98) {
        throw new Error('Invalid recipient address. Address must start with "ccx7" and be 98 characters long.');
      }

      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Ensure wallet and blockchain explorer are available
      if (!WalletService.wallet) {
        throw new Error('Wallet not initialized');
      }

      if (!WalletService.blockchainExplorer) {
        WalletService.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await WalletService.blockchainExplorer.initialize();
      }

      // Optimized: Get both height and fee address in one call (single node request)
      const prepTxInfo = await WalletService.blockchainExplorer.getPrepTxInfo();
      const blockchainHeight = prepTxInfo.height;
      const remoteFeeAddress = prepTxInfo.feeAddress;

      // Prepare destination
      const destinations = [
        {
          address: recipientAddress,
          amount: amount,
        },
      ];

      // Add remote node fee as second destination (dsts[1])
      // Only add if we have a remote fee address AND it's not our own wallet
      if (remoteFeeAddress && remoteFeeAddress !== WalletService.wallet.getPublicAddress()) {
        destinations.push({ address: remoteFeeAddress, amount: config.remoteNodeFee });
      } else if (!remoteFeeAddress) {
        // Default to donation address if no remote node fee address provided
        destinations.push({ address: config.donationAddress, amount: config.remoteNodeFee });
      }
      // If remoteFeeAddress === our wallet address, skip adding fee (we're operating the node)

      // Get mixouts callback - this gets the random outputs needed for privacy
      const obtainMixOutsCallback = async (amounts: number[], nbOutsNeeded: number) => {
        try {
          const mixouts = await WalletService.blockchainExplorer.getRandomOuts(amounts, nbOutsNeeded);
          return mixouts;
        } catch (error) {
          console.error('WalletService: Error getting mixouts:', error);
          throw error;
        }
      };

      // Confirmation callback - returns promise to confirm transaction
      const confirmCallback = async (sendAmountAtoms: number, feeAmountAtoms: number): Promise<void> => {
        // For now, always confirm (later we can add user prompt if needed)
        return Promise.resolve();
      };

      // Make logDebugMsg globally available for TransactionsExplorer
      (global as any).logDebugMsg = logDebugMsg;

      // Create transaction using TransactionsExplorer
      getGlobalWorkletLogging().logging1string('WalletService: Creating transaction...');
      //console.log('WalletService: Creating transaction...');
      const transactionResult = await TransactionsExplorer.createTx(
        destinations,
        paymentId,
        WalletService.wallet,
        blockchainHeight,
        obtainMixOutsCallback,
        confirmCallback,
        config.defaultMixin || 5, // Default mixin level
        message,
        'chacha8',
        0, // TTL
        'regular', // Transaction type
        0 // Term (for deposits)
      );

      // Get raw transaction data
      const rawTx = transactionResult.raw.raw;
      const txHash = transactionResult.raw.hash;

      if (!rawTx) {
        throw new Error('Failed to generate raw transaction data');
      }

      // Broadcast transaction
      const broadcastResult = await WalletService.blockchainExplorer.sendRawTx(rawTx);

      if (broadcastResult.status !== 'OK') {
        throw new Error(`Transaction broadcast failed: ${broadcastResult.status}`);
      }

      WalletService.wallet.addTxPrivateKeyWithTxHash(txHash, transactionResult.raw.prvkey);

      // Force mempool check
      if (WalletService.walletWatchdog) {
        WalletService.walletWatchdog.checkMempool();
      }

      getGlobalWorkletLogging().logging2string('WalletService: Transaction sent successfully, hash:', txHash);

      // DON'T call signalWalletUpdate() - it triggers lastBlockLoading = -1 causing full resync!
      // Continuous sync will naturally pick up the new transaction

      return txHash;
    } catch (error) {
      console.error('WalletService: Error sending transaction:', error);

      // Provide user-friendly error messages
      let errorMessage = 'Failed to send transaction';

      if (error.message.includes('balance_too_low')) {
        errorMessage = 'Insufficient balance for transaction';
      } else if (error.message.includes('invalid')) {
        errorMessage = error.message;
      } else if (error.message.includes('Address')) {
        errorMessage = error.message;
      } else if (error.message.includes('Amount')) {
        errorMessage = error.message;
      } else {
        errorMessage = `Transaction failed: ${error.message}`;
      }

      throw new Error(errorMessage);
    }
  }
}
