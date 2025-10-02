/**
*     Copyright (c) 2025, Acktarius 
*/
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { WalletStorageManager } from './WalletStorageManager';
import { BiometricService } from './BiometricService';
import { Wallet, RawWallet } from '../model/Wallet';
import { KeysRepository } from '../model/KeysRepository';
import { SharedKey } from '../model/Transaction';
import { Cn, CnNativeBride, CnRandom } from '../model/Cn';
import { BlockchainExplorerRpcDaemon } from '../model/blockchain/BlockchainExplorerRPCDaemon';
import { Alert } from 'react-native';
import { ImportService } from './ImportService';
import { WalletRepository } from '../model/WalletRepository';
import { WalletWatchdogRN } from '../model/WalletWatchdogRN';
import { IWalletOperations } from './interfaces/IWalletOperations';
import { dependencyContainer } from './DependencyContainer';
import { TransactionsExplorer } from '../model/TransactionsExplorer';
import { SmartMessageParser } from '../model/SmartMessage';
import { config, logDebugMsg } from '../config';
import { JSBigInt } from '../lib/biginteger';
import { Platform, BackHandler } from 'react-native';

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
      this.flag_prompt_main_tab = settings.flag_prompt_main_tab || false;
      this.flag_prompt_wallet_tab = settings.flag_prompt_wallet_tab || false;
      console.log('WALLET SERVICE: Loaded upgrade flags:', {
        flag_prompt_main_tab: this.flag_prompt_main_tab,
        flag_prompt_wallet_tab: this.flag_prompt_wallet_tab
      });
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
        flag_prompt_main_tab: this.flag_prompt_main_tab,
        flag_prompt_wallet_tab: this.flag_prompt_wallet_tab
      });
      console.log('WALLET SERVICE: Saved upgrade flags:', {
        flag_prompt_main_tab: this.flag_prompt_main_tab,
        flag_prompt_wallet_tab: this.flag_prompt_wallet_tab
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
    return this.wallet !== null;
  }

  static getCachedWallet(): Wallet | null {
    return this.wallet;
  }

  // Pragmatic approach: Register a callback for balance refresh
  static registerBalanceRefreshCallback(callback: () => void): void {
    this.balanceRefreshCallback = callback;
    console.log('WalletService: Balance refresh callback registered');
  }

  // Pragmatic approach: Trigger balance refresh directly
  static triggerBalanceRefresh(): void {
    if (this.balanceRefreshCallback) {
      console.log('WalletService: Triggering balance refresh via callback');
      this.balanceRefreshCallback();
    } else {
      console.log('WalletService: No balance refresh callback registered');
    }
  }

  // Pragmatic approach: Register a callback for shared keys refresh
  static registerSharedKeysRefreshCallback(callback: () => void): void {
    this.sharedKeysRefreshCallback = callback;
    console.log('WalletService: Shared keys refresh callback registered');
  }

  // Pragmatic approach: Trigger shared keys refresh directly
  static triggerSharedKeysRefresh(): void {
    if (this.sharedKeysRefreshCallback) {
      console.log('WalletService: Triggering shared keys refresh via callback');
      this.sharedKeysRefreshCallback();
    } else {
      console.log('WalletService: No shared keys refresh callback registered');
    }
  }

  // Global janitor function - call this after processing transactions
  static async janitor(): Promise<void> {
    try {
      console.log('WalletService: janitor() called - performing maintenance');
      
      // 1. Save wallet to storage (persist any changes)
      await this.saveWallet('janitor maintenance');
      
      // 2. Trigger balance refresh directly
      this.triggerBalanceRefresh();
      
      // 3. Trigger shared keys refresh (for smart message updates)
      this.triggerSharedKeysRefresh();
      
      console.log('WalletService: janitor() completed');
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
  async sendSmartMessage(action: 'create' | 'delete', sharedKey: any, paymentId?: string): Promise<{success: boolean, txHash?: string}> {
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
      jsonData + this.ENCRYPTION_KEY
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
      if (this.blockchainExplorer) {
        // Reset nodes to pick up custom node changes (like WebWallet does)
        await this.blockchainExplorer.resetNodes();
        console.log('WALLET SERVICE: Blockchain explorer nodes reset for custom node changes');
      }
    } catch (error) {
      console.error('WALLET SERVICE: Error resetting blockchain explorer nodes:', error);
    }
  }

  static getCurrentSessionNodeUrl(): string | null {
    try {
      if (this.blockchainExplorer) {
        return this.blockchainExplorer.getCurrentSessionNodeUrl();
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
      await this.loadUpgradeFlags();

      // Initialize blockchain explorer if not already done
      if (!this.blockchainExplorer) {
        this.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await this.blockchainExplorer.initialize();
      }

      // Use already loaded wallet if available, otherwise load it
      console.log('WALLET SERVICE: getOrCreateWallet - checking wallet state:', {
        hasWalletInstance: !!this.wallet,
        walletAddress: this.wallet?.getPublicAddress() || 'none',
        walletIsLocal: this.wallet?.isLocal(),
        walletCreationHeight: this.wallet?.creationHeight,
        walletLastHeight: this.wallet?.lastHeight
      });
      
      let wallet = this.wallet || await WalletStorageManager.getWallet();
      
      console.log('WALLET SERVICE: getOrCreateWallet - wallet after load:', {
        hasWallet: !!wallet,
        walletAddress: wallet?.getPublicAddress() || 'none',
        walletIsLocal: wallet?.isLocal(),
        walletCreationHeight: wallet?.creationHeight,
        walletLastHeight: wallet?.lastHeight,
        loadedFromInstance: wallet === this.wallet,
        loadedFromStorage: wallet !== this.wallet
      });
      
      // If no wallet exists at all, create a local-only wallet first
      // BUT: If this is due to authentication failure, we should NOT create a new wallet
      // as this would overwrite the existing blockchain wallet
      if (!wallet) {
        console.log('WALLET SERVICE: No wallet loaded - checking if this is a new user or auth failure...');
        
        // Check if this is a new user (no data) vs auth failure (data exists but can't decrypt)
        const hasAnyWalletData = await this.hasAnyWalletData();
        if (hasAnyWalletData) {
          console.log('WALLET SERVICE: Wallet data exists but authentication failed - EXITING APP for security');
          // Exit app immediately - authentication failure
          if (Platform.OS === 'android') {
            BackHandler.exitApp();
          } else {
            // iOS doesn't allow programmatic exit
            Alert.alert(
              'Authentication Failed',
              'Unable to access wallet. Please restart the app.',
              [{ text: 'OK', onPress: () => {} }]
            );
          }
          throw new Error('Authentication failed - app exiting');
        } else {
          console.log('WALLET SERVICE: No wallet data exists - creating new local wallet for new user');
          wallet = await this.createLocalWallet();
        }
      }
      
      // Set the wallet instance for future calls
      this.wallet = wallet;
      
      // If wallet exists but is local-only (no keys), check flags and show prompt
      if (wallet && wallet.isLocal()) {
        console.log('WALLET SERVICE: Local wallet detected, checking flags...');
        console.log('WALLET SERVICE: flag_prompt_main_tab:', this.flag_prompt_main_tab);
        console.log('WALLET SERVICE: flag_prompt_wallet_tab:', this.flag_prompt_wallet_tab);
        console.log('WALLET SERVICE: callerScreen:', callerScreen);
        console.log('WALLET SERVICE: Condition check (!main || !wallet):', (!this.flag_prompt_main_tab || !this.flag_prompt_wallet_tab));
        
        // Only show prompt if not prompted before
        if (!this.flag_prompt_main_tab || !this.flag_prompt_wallet_tab) {
          console.log('WALLET SERVICE: Showing upgrade prompt...');
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
            this.flag_prompt_main_tab = true;
            console.log('WALLET SERVICE: Set flag_prompt_main_tab = true');
          } else if (callerScreen === 'wallet') {
            this.flag_prompt_wallet_tab = true;
            console.log('WALLET SERVICE: Set flag_prompt_wallet_tab = true');
          }
          
          // Save flags to storage
          await this.saveUpgradeFlags();
          
          console.log('WALLET SERVICE: User choice:', result);

          if (result === 'cancel') {
            return wallet;
          }

          if (result === 'import') {
            wallet = await ImportService.importWallet();
            // Update cached instance with the imported wallet
            this.wallet = wallet;
          } else {
            wallet = await this.upgradeToBlockchainWallet();
            // Update cached instance with the upgraded wallet
            this.wallet = wallet;
          }
        }
      }
      
      return wallet;
    } catch (error) {
      console.error('Error getting/creating wallet:', error);
      console.error('Wallet initialization error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
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
        console.log('CREATE LOCAL: Encrypting local wallet with biometric key');
        
        // Generate biometric salt FIRST
        const randomSalt = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256, 
          'biometric_salt_' + Date.now() + Math.random()
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
        console.log('CREATE LOCAL: Password mode - using PasswordCreationAlert');
        const password = await WalletService.promptForPasswordCreation('Create a password to secure your local wallet:');
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
    console.log('PASSWORD PROMPT: Starting password prompt with message:', message);
    
    // Get the password prompt context from global state
    const passwordPromptContext = (global as any).passwordPromptContext;
    console.log('PASSWORD PROMPT: Context available:', !!passwordPromptContext);
    
    if (!passwordPromptContext) {
      throw new Error('Password prompt context not available. App must be properly initialized.');
    }
    
    console.log('PASSWORD PROMPT: Calling showPasswordPromptAlert...');
    const result = await passwordPromptContext.showPasswordPromptAlert('Wallet Password Required', message);
    console.log('PASSWORD PROMPT: Result received:', result ? '***' : 'null');
    return result;
  }

  static async promptForPasswordCreation(message: string): Promise<string | null> {
    console.log('PASSWORD CREATION: Starting password creation prompt with message:', message);
    
    // Get the password prompt context from global state
    const passwordPromptContext = (global as any).passwordPromptContext;
    console.log('PASSWORD CREATION: Context available:', !!passwordPromptContext);
    
    if (!passwordPromptContext) {
      throw new Error('Password prompt context not available. App must be properly initialized.');
    }
    
    console.log('PASSWORD CREATION: Calling showPasswordCreationAlert...');
    const result = await passwordPromptContext.showPasswordCreationAlert('Create Wallet Password', message);
    console.log('PASSWORD CREATION: Result received:', result ? '***' : 'null');
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
        console.log('UPGRADE: Using biometric authentication for wallet upgrade');
        // We'll encrypt with biometric key after upgrade
      } else {
        // Fallback to password if biometric not available
        console.log('UPGRADE: Biometric not available, requesting password for wallet upgrade');
        password = await WalletService.promptForPassword('Enter a password to secure your upgraded wallet:');
        if (!password) {
          console.log('UPGRADE: No password provided, returning existing local wallet');
          return existingWallet;
        }
        console.log('UPGRADE: Password accepted, proceeding with upgrade');
      }

      // Generate random seed using Cn functions - this works offline
      let seed = CnNativeBride.sc_reduce32(CnRandom.rand_32());
      
      // Create address and keys using Cn functions - this works offline
      let keys = Cn.create_address(seed);
      
      // Set initial creation height
      // If offline, we'll start from 0 and sync later
      let creationHeight = 0;

      // Try to get blockchain height if possible, but don't block on it
      try {
        if (!this.blockchainExplorer) {
          console.log('UPGRADE: Creating new BlockchainExplorerRpcDaemon for upgrade');
          this.blockchainExplorer = new BlockchainExplorerRpcDaemon();
          
          console.log('UPGRADE: Initializing blockchain explorer...');
          await Promise.race([
            this.blockchainExplorer.initialize(),
            new Promise((_, reject) => setTimeout(() => reject('TIMEOUT'), 5000))
          ]);
          
          console.log('UPGRADE: Getting blockchain height...');
          const currentHeight = await Promise.race([
            this.blockchainExplorer.getHeight(),
            new Promise<number>((_, reject) => setTimeout(() => reject('TIMEOUT'), 5000))
          ]);
          
          creationHeight = Math.max(0, currentHeight - 10);
          console.log('UPGRADE: Blockchain height retrieved:', currentHeight, 'creationHeight set to:', creationHeight);
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
        console.log('UPGRADE: Encrypting wallet with biometric key');
        
        // Use existing biometric salt (don't generate new one for upgrade)
        const biometricKey = await WalletStorageManager.deriveBiometricKey();
        if (!biometricKey) {
          throw new Error('Failed to generate biometric key for wallet encryption');
        }
        await WalletStorageManager.saveEncryptedWallet(wallet, biometricKey);
      } else {
        // Encrypt with user password
        console.log('UPGRADE: Encrypting wallet with user password');
        await WalletStorageManager.saveEncryptedWallet(wallet, password!);
        
        // Generate biometric salt from user password (for future biometric mode switching)
        await WalletStorageManager.generateAndStoreBiometricSalt(password!);
      }

      // Set the wallet instance
      this.wallet = wallet;

      // Start wallet synchronization after upgrade
      try {
        await this.startWalletSynchronization();
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
        name: error.name
      });
      throw new Error(`Failed to upgrade wallet: ${error.message}`);
    }
  }

  static async addSharedKey(serviceData: { name: string; issuer: string; secret: string }): Promise<void> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    const sharedKey = SharedKey.fromRaw(serviceData);
    
    // Add to blockchain compatible transactions
    this.wallet.addNew(sharedKey, true);
    
    // Save wallet state
    await this.saveWalletState();
  }

  static async removeSharedKey(hash: string): Promise<void> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    const isAuthenticated = await this.authenticateUser();
    if (!isAuthenticated) {
      throw new Error('Authentication failed');
    }

    // Use wallet's methods to handle transactions
    const tx = this.wallet.findWithTxHash(hash);
    if (tx) {
      this.wallet.clearTransactions(); // Clear all and rebuild without the removed key
      await this.saveWalletState();
    }
  }

  private static async saveWalletState(): Promise<void> {
    if (!this.wallet) return;

    // Get the current authentication mode to determine encryption key
    const isBiometricEnabled = await BiometricService.isBiometricEnabled();
    
    if (isBiometricEnabled) {
      // Use biometric key for encryption
      const biometricKey = await WalletStorageManager.deriveBiometricKey();
      if (biometricKey) {
        await WalletStorageManager.saveEncryptedWallet(this.wallet, biometricKey);
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
    this.stopWalletSynchronization();
    
    if (this.blockchainExplorer) {
      this.blockchainExplorer.cleanupSession();
    }
    this.wallet = null;
  }

  /**
   * Completely resets the wallet state, clearing all data and returning to initial state.
   * This is called when user clears all data.
   */
  static async resetWallet(): Promise<void> {
    // Stop wallet synchronization
    this.stopWalletSynchronization();
    
    // Clear blockchain connections
    if (this.blockchainExplorer) {
      this.blockchainExplorer.cleanupSession();
      this.blockchainExplorer = null;
    }
    
    // Clear wallet instance
    this.wallet = null;
    
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
      this.stopWalletSynchronization();
      
      // Clear blockchain connections
      if (this.blockchainExplorer) {
        this.blockchainExplorer.cleanupSession();
        this.blockchainExplorer = null;
      }
      
      // Clear wallet instance
      this.wallet = null;
      
      // Clear all storage using StorageService
      const storageService = dependencyContainer.getStorageService();
      await storageService.clearAll();
      
      console.log('Force clear all completed');
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
      console.log('TESTING: Starting complete app reset...');
      
      // 1. Clear all wallet data
      await WalletStorageManager.clearWallet();
      console.log('TESTING: Wallet data cleared');
      
      // 2. Clear custom node settings
      await WalletStorageManager.clearCustomNode();
      console.log('TESTING: Custom node cleared');
      
      // 3. Clear all session data
      //WalletStorageManager.clearCurrentSessionPasswordKey();
      //console.log('TESTING: Session data cleared');
      
      // 4. Reset all service flags
      this.flag_prompt_main_tab = false;
      this.flag_prompt_wallet_tab = false;
      this.wallet = null;
      console.log('TESTING: Service flags reset');
      
      // 5. Reset biometric to default (enabled)
      const storageService = dependencyContainer.getStorageService();
      await storageService.saveSettings({
        biometricAuth: true  // Default to enabled
      });
      console.log('TESTING: Biometric reset to default (enabled)');
      
      // 6. Clear any blockchain explorer state
      if (this.blockchainExplorer) {
        this.blockchainExplorer.cleanupSession();
      }
      console.log('TESTING: Blockchain explorer state cleared');
      
      // 7. Clear wallet watchdog
      if (this.walletWatchdog) {
        this.walletWatchdog.stop();
        this.walletWatchdog = null;
      }
      console.log('TESTING: Wallet watchdog cleared');
      
      console.log('TESTING: Complete app reset finished successfully');
    } catch (error) {
      console.error('TESTING: Error during complete app reset:', error);
      throw error;
    }
  }
  

  /**
   * Reset upgrade prompt flags (called after clear data)
   */
  static async resetUpgradeFlags(): Promise<void> {
    console.log('WALLET SERVICE: Resetting upgrade flags...');
    console.log('WALLET SERVICE: Before reset - flag_prompt_main_tab:', this.flag_prompt_main_tab);
    console.log('WALLET SERVICE: Before reset - flag_prompt_wallet_tab:', this.flag_prompt_wallet_tab);
    console.log('WALLET SERVICE: Before reset - cached wallet exists:', !!this.wallet);
    
    this.flag_prompt_main_tab = false;
    this.flag_prompt_wallet_tab = false;
    this.wallet = null; // Clear cached wallet instance
    
    // Save cleared flags to storage
    await this.saveUpgradeFlags();
    
    console.log('WALLET SERVICE: After reset - flag_prompt_main_tab:', this.flag_prompt_main_tab);
    console.log('WALLET SERVICE: After reset - flag_prompt_wallet_tab:', this.flag_prompt_wallet_tab);
    console.log('WALLET SERVICE: After reset - cached wallet exists:', !!this.wallet);
    console.log('WALLET SERVICE: Upgrade flags and cached wallet reset');
  }

  static async clearWalletAndCache(): Promise<void> {
    console.log('WALLET SERVICE: Clearing wallet from storage and cache...');
    await WalletStorageManager.clearWallet();
    await WalletStorageManager.clearCustomNode()
    //WalletStorageManager.clearCurrentSessionPasswordKey();
    //console.log('TESTING: Session data cleared');
    
    // 4. Reset all service flags
    this.flag_prompt_main_tab = false;
    this.flag_prompt_wallet_tab = false;
    this.wallet = null; // Clear cached instance
    const storageService = dependencyContainer.getStorageService();
    await storageService.saveSettings({
      biometricAuth: true  // Default to enabled
    });
    console.log('WALLET SERVICE: Biometric reset to default (enabled)');
    
    // Clear any blockchain explorer state
    if (this.blockchainExplorer) {
      this.blockchainExplorer.cleanupSession();
    }
    // Clear wallet watchdog
    if (this.walletWatchdog) {
      this.walletWatchdog.stop();
      this.walletWatchdog = null;
    }
    console.log('WALLET SERVICE: Wallet cleared from storage and cache');
  }

  static async clearCachedWallet(): Promise<void> {
    console.log('WALLET SERVICE: Refreshing cached wallet from storage...');
    this.wallet = null; // Clear cached instance to force reload from storage
    console.log('WALLET SERVICE: Cached wallet cleared, will reload from storage on next access');
  }


  /**
   * Start wallet synchronization with blockchain
   */
  static async startWalletSynchronization(): Promise<void> {
    try {
      // Load wallet from storage if cached instance is null
      if (!this.wallet) {
        console.log('WALLET SERVICE: No cached wallet, loading from storage...');
        this.wallet = await WalletStorageManager.getWallet();
        if (!this.wallet) {
          throw new Error('No wallet available for synchronization');
        }
        console.log('WALLET SERVICE: Wallet loaded from storage for synchronization');
      }

      if (!this.blockchainExplorer) {
        this.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await this.blockchainExplorer.initialize();
      }

      // Create watchdog if not exists
      if (!this.walletWatchdog) {
        this.walletWatchdog = new WalletWatchdogRN(this.wallet, this.blockchainExplorer);
      }

      // Start synchronization
      this.walletWatchdog.start();
      
      console.log('WALLET SERVICE: Wallet synchronization started');
    } catch (error) {
      console.error('WALLET SERVICE: Error starting wallet synchronization:', error);
      throw error;
    }
  }

  /**
   * Stop wallet synchronization
   */
  static stopWalletSynchronization(): void {
    if (this.walletWatchdog) {
      this.walletWatchdog.stop();
      this.walletWatchdog = null;
      console.log('WALLET SERVICE: Wallet synchronization stopped');
    }
  }

  /**
   * Get wallet synchronization status
   */
  static getWalletSyncStatus(): any {
    if (this.walletWatchdog && this.wallet) {
      const lastBlockLoading = this.walletWatchdog.getLastBlockLoading();
      const blockList = this.walletWatchdog.getBlockList();
      const blockchainHeight = this.walletWatchdog.getBlockchainHeight();
      
      return {
        isRunning: true,
        lastBlockLoading: lastBlockLoading,
        lastMaximumHeight: blockchainHeight,
        transactionsInQueue: blockList ? blockList.getTxQueue().getSize() : 0,
        //isWalletSynced: lastBlockLoading >= blockchainHeight - 1 // Allow 1 block tolerance
        isWalletSynced: blockchainHeight > 0 && lastBlockLoading >= blockchainHeight && this.wallet.lastHeight >= blockchainHeight
      };
    }
    return {
      isRunning: false,
      lastBlockLoading: 0,
      lastMaximumHeight: 0,
      transactionsInQueue: 0,
      isWalletSynced: false
    };
  }

  static async triggerManualSave(): Promise<void> {
    console.log('WalletService: Triggering manual save from UI');
    await this.saveWallet('manual save from UI');
  }

  /**
   * Improved saveWallet method - works in both biometric and password modes
   * Uses stored session keys for quiet saves without re-authentication
   */
  static async saveWallet(reason: string = 'manual save'): Promise<void> {
    try {
      console.log('WalletService: Saving wallet:', reason);
      
      if (!this.wallet) {
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
        const encryptedWallet = WalletRepository.save(this.wallet, encryptionKey);
        await WalletStorageManager.saveEncryptedWalletData(encryptedWallet);
        
        // Set flag only for password mode (not biometric)
        if (!(await BiometricService.isBiometricChecked())) {
          await SecureStore.setItemAsync('wallet_has_password', 'true');
        }
        
        console.log('WalletService: Wallet saved quietly (no re-authentication) - lastHeight:', this.wallet.lastHeight);
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
        return this.wallet!; // Return current wallet without changes
      } else if (result === 'import') {
        const importedWallet = await ImportService.importWallet();
        // Update cached instance with the imported wallet
        this.wallet = importedWallet;
        return importedWallet;
      } else {
        return await this.upgradeToBlockchainWallet();
      }
    } catch (error) {
      console.error('Error triggering wallet upgrade:', error);
      throw error;
    }
  }

  // Signal wallet update to trigger watchdog rescan
  static async signalWalletUpdate(): Promise<void> {
    try {
      console.log('WalletService: Signaling wallet update for rescan');
      if (this.walletWatchdog) {
        this.walletWatchdog.signalWalletUpdate();
      } else {
        console.log('WalletService: No wallet watchdog available for signal');
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
      if (!this.wallet || this.wallet.isLocal()) {
        throw new Error('Wallet must be blockchain-enabled to broadcast');
      }

      if (!this.blockchainExplorer) {
        throw new Error('Blockchain explorer not initialized');
      }

      // Check if wallet is synced
      const syncStatus = this.getWalletSyncStatus();
      if (!syncStatus.isWalletSynced) {
        throw new Error('Wallet must be synced to broadcast');
      }

      console.log('WalletService: Broadcasting 2FA code', {
        recipientAddress: recipientAddress.substring(0, 10) + '...',
        serviceName,
        code: code.substring(0, 3) + '***',
        timeRemaining
      });

      // Get blockchain height
      const blockchainHeight = await this.blockchainExplorer.getHeight();
      
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
          hour12: true
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
      
      let destination: any[] = [{ address: recipientAddress, amount: amountToSend }];
      
      // Get fee address from session node for remote node fee (following webWallet pattern)
      const remoteFeeAddress = await this.blockchainExplorer.getSessionNodeFeeAddress();
      
      if (remoteFeeAddress !== this.wallet.getPublicAddress()) {
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
        this.wallet,
        blockchainHeight,
        (amounts: number[], numberOuts: number): Promise<any> => {
          return this.blockchainExplorer!.getRandomOuts(amounts, numberOuts);
        },
        (amount: number, feesAmount: number): Promise<void> => {
          if (amount + feesAmount > this.wallet!.availableAmount(blockchainHeight)) {
            throw new Error('Insufficient balance for transaction');
          }
          return Promise.resolve();
        },
        mixinToSendWith || 5,
        message,
        ttl,
        "regular",
        0
      );

      // Send transaction (following webWallet pattern)
      await this.blockchainExplorer.sendRawTx(rawTxData.raw.raw);
      
      // Check if sendRawTx actually succeeded
      /*if (!sendResult || sendResult.status !== 'OK') {
        throw new Error(`Failed to send raw transaction: ${sendResult?.status || 'Unknown error'}`);
      }
      */
      
      // Save transaction private key
      this.wallet.addTxPrivateKeyWithTxHash(rawTxData.raw.hash, rawTxData.raw.prvkey);

      // Force mempool check
      if (this.walletWatchdog) {
        this.walletWatchdog.checkMempool();
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
  ): Promise<{success: boolean, txHash?: string}> {
    try {
      // Validate wallet state
      if (!this.wallet || this.wallet.isLocal()) {
        throw new Error('Wallet must be blockchain-enabled to send smart messages');
      }

      if (!this.blockchainExplorer) {
        this.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await this.blockchainExplorer.initialize();
      }

      // Check if wallet is synced
      const syncStatus = this.getWalletSyncStatus();
      if (!syncStatus.isWalletSynced) {
        throw new Error('Wallet must be synced to send smart messages');
      }

      // Calculate minimum balance needed: messageTxAmount + nodeFee + coinFee
      const minBalance = config.messageTxAmount.add(config.remoteNodeFee).add(config.coinFee);
      const walletAmountBigInt = new JSBigInt(this.wallet.amount.toString());
      if (walletAmountBigInt.compare(minBalance) < 0) {
        throw new Error('Insufficient balance for smart message');
      }

      console.log('WalletService: Sending smart message', {
        action,
        sharedKeyName: sharedKey.name,
        sharedKeyHash: sharedKey.hash || 'new'
      });

      // Get blockchain height
      const blockchainHeight = await this.blockchainExplorer.getHeight();
      
      // Create smart message command using SmartMessageParser methods
      let smartMessageResult: any;
      
      if (action === 'create') {
        // Use SmartMessageParser.encode2FA() for encoding create command
        smartMessageResult = await SmartMessageParser.encode2FA('c', sharedKey.name, sharedKey.issuer, sharedKey.secret);
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

      console.log('WalletService: Smart message content:', smartMessage);
      console.log('WalletService: Smart message length:', smartMessage.length);
      console.log('WalletService: Smart message type:', typeof smartMessage);

      // Smart message specific parameters (following webWallet pattern)
      const amountToSend = config.messageTxAmount.toJSValue(); // Convert JSBigInt to number
      const destinationAddress = this.wallet.getPublicAddress();
      const mixinToSendWith = config.defaultMixin;
      
      let destination: any[] = [{ address: destinationAddress, amount: amountToSend }];
      
      // Get fee address from session node for remote node fee (following webWallet pattern)
      const remoteFeeAddress = await this.blockchainExplorer.getSessionNodeFeeAddress();
      
      if (remoteFeeAddress !== this.wallet.getPublicAddress()) {
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
            console.log('WalletService: Using whitelisted payment ID for smart message:', finalPaymentId);
          }
        } catch (error) {
          console.log('WalletService: Could not get payment ID whitelist, using empty payment ID');
        }
      }

      // Create transaction (following webWallet pattern exactly)
      const rawTxData = await TransactionsExplorer.createTx(
        destination,
        finalPaymentId,
        this.wallet,
        blockchainHeight,
        (amounts: number[], numberOuts: number): Promise<any> => {
          return this.blockchainExplorer!.getRandomOuts(amounts, numberOuts);
        },
        (amount: number, feesAmount: number): Promise<void> => {
          if (amount + feesAmount > this.wallet!.availableAmount(blockchainHeight)) {
            throw new Error('Insufficient balance for transaction');
          }
          return Promise.resolve();
        },
        mixinToSendWith || 5,
        smartMessage,
        0, // TTL
        "regular",
        0
      );

      // Send transaction (following webWallet pattern)
      await this.blockchainExplorer.sendRawTx(rawTxData.raw.raw);
      
      // Save transaction private key (following webWallet pattern)
      this.wallet.addTxPrivateKeyWithTxHash(rawTxData.raw.hash, rawTxData.raw.prvkey);

      // Update shared key with transaction hash ONLY after successful send
      if (action === 'create') {
        sharedKey.hash = rawTxData.raw.hash;
        console.log('WalletService: Set sharedKey.hash to:', rawTxData.raw.hash, '(after successful send)');
      }

      // Force mempool check (following webWallet pattern)
      if (this.walletWatchdog) {
        this.walletWatchdog.checkMempool();
      }

      console.log('WalletService: Smart message sent successfully', {
        action,
        txHash: rawTxData.raw.hash,
        sharedKeyName: sharedKey.name
      });

      return {
        success: true,
        txHash: rawTxData.raw.hash
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
        txHash: undefined // No hash since transaction wasn't sent successfully
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
      if (!this.wallet) {
        throw new Error('Wallet not initialized');
      }
      
      if (!this.blockchainExplorer) {
        this.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await this.blockchainExplorer.initialize();
      }

      console.log('WalletService: Starting send transaction', {
        recipientAddress: recipientAddress.substring(0, 10) + '...',
        amountAtoms: amount,
        amountHuman: (amount / Math.pow(10, config.coinUnitPlaces)).toFixed(6),
        paymentId: paymentId ? '***' : 'none',
        message: message ? '***' : 'none'
      });

      // Get current blockchain height for mixin selection
      const blockchainHeight = await this.blockchainExplorer.getHeight();
      console.log('WalletService: Blockchain height:', blockchainHeight);

      // Prepare destination
      const destinations = [{
        address: recipientAddress,
        amount: amount
      }];

      // Get fee address from session node for remote node fee
      const remoteFeeAddress = await this.blockchainExplorer.getSessionNodeFeeAddress();
      
      // Add remote node fee as second destination (dsts[1])
      // Only add if we have a remote fee address AND it's not our own wallet
      if (remoteFeeAddress && remoteFeeAddress !== this.wallet.getPublicAddress()) {
        destinations.push({ address: remoteFeeAddress, amount: config.remoteNodeFee });
      } else if (!remoteFeeAddress) {
        // Default to donation address if no remote node fee address provided
        destinations.push({ address: config.donationAddress, amount: config.remoteNodeFee });
      }
      // If remoteFeeAddress === our wallet address, skip adding fee (we're operating the node)

      // Get mixouts callback - this gets the random outputs needed for privacy
      const obtainMixOutsCallback = async (amounts: number[], nbOutsNeeded: number) => {
        try {
          console.log('WalletService: Requesting mixouts for amounts:', amounts, 'needed:', nbOutsNeeded);
          const mixouts = await this.blockchainExplorer.getRandomOuts(amounts, nbOutsNeeded);
          console.log('WalletService: Received mixouts:', mixouts.length);
          return mixouts;
        } catch (error) {
          console.error('WalletService: Error getting mixouts:', error);
          throw error;
        }
      };

      // Confirmation callback - returns promise to confirm transaction
      const confirmCallback = async (sendAmountAtoms: number, feeAmountAtoms: number): Promise<void> => {
        console.log('WalletService: Transaction confirmation required', {
          sendAmountAtoms: sendAmountAtoms,
          sendAmountHuman: (sendAmountAtoms / Math.pow(10, config.coinUnitPlaces)).toFixed(6) + ' CCX',
          feeAmountAtoms: feeAmountAtoms,
          feeAmountHuman: (feeAmountAtoms / Math.pow(10, config.coinUnitPlaces)).toFixed(6) + ' CCX'
        });
        // For now, always confirm (later we can add user prompt if needed)
        return Promise.resolve();
      };

      // Make logDebugMsg globally available for TransactionsExplorer
      (global as any).logDebugMsg = logDebugMsg;
      
      // Create transaction using TransactionsExplorer
      console.log('WalletService: Creating transaction...');
      const transactionResult = await TransactionsExplorer.createTx(
        destinations,
        paymentId,
        this.wallet,
        blockchainHeight,
        obtainMixOutsCallback,
        confirmCallback,
        config.defaultMixin || 5, // Default mixin level
        message,
        0, // TTL
        "regular", // Transaction type
        0 // Term (for deposits)
      );

      console.log('WalletService: Transaction created successfully');

      // Get raw transaction data
      const rawTx = transactionResult.raw.raw;
      const txHash = transactionResult.raw.hash;

      if (!rawTx) {
        throw new Error('Failed to generate raw transaction data');
      }

      console.log('WalletService: Broadcasting transaction...');

      // Broadcast transaction
      const broadcastResult = await this.blockchainExplorer.sendRawTx(rawTx);
      
      console.log('WalletService: Transaction broadcast result:', broadcastResult);
      
      if (broadcastResult.status !== 'OK') {
        throw new Error(`Transaction broadcast failed: ${broadcastResult.status}`);
      }

      this.wallet.addTxPrivateKeyWithTxHash(txHash, transactionResult.raw.prvkey);

      // Force mempool check
      if (this.walletWatchdog) {
        this.walletWatchdog.checkMempool();
      } 

      console.log('WalletService: Transaction sent successfully, hash:', txHash);

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
