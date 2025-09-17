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
import { StorageService } from './StorageService';
import { WalletWatchdogRN } from '../model/WalletWatchdogRN';



export class WalletService {
  private static readonly ENCRYPTION_KEY = 'wallet_encryption_key';
  private static wallet: Wallet | null = null;
  private static blockchainExplorer: BlockchainExplorerRpcDaemon | null = null;
  private static walletWatchdog: WalletWatchdogRN | null = null;
  
  // Session flags (reset to false on app launch)
  private static flag_prompt_main_tab = false;
  private static flag_prompt_wallet_tab = false;

  static hasActiveWallet(): boolean {
    return this.wallet !== null;
  }

  static getCachedWallet(): Wallet | null {
    return this.wallet;
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
      if (!wallet) {
        wallet = await this.createLocalWallet();
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

          // Set flag based on calling screen
          if (callerScreen === 'home') {
            this.flag_prompt_main_tab = true;
            console.log('WALLET SERVICE: Set flag_prompt_main_tab = true');
          } else if (callerScreen === 'wallet') {
            this.flag_prompt_wallet_tab = true;
            console.log('WALLET SERVICE: Set flag_prompt_wallet_tab = true');
          }
          
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
      await StorageService.clearAll();
      
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
      const { StorageService } = await import('./StorageService');
      await StorageService.saveSettings({
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
    
    console.log('WALLET SERVICE: After reset - flag_prompt_main_tab:', this.flag_prompt_main_tab);
    console.log('WALLET SERVICE: After reset - flag_prompt_wallet_tab:', this.flag_prompt_wallet_tab);
    console.log('WALLET SERVICE: After reset - cached wallet exists:', !!this.wallet);
    console.log('WALLET SERVICE: Upgrade flags and cached wallet reset');
  }

  static async clearWalletAndCache(): Promise<void> {
    console.log('WALLET SERVICE: Clearing wallet from storage and cache...');
    await WalletStorageManager.clearWallet();
    this.wallet = null; // Clear cached instance
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
        isWalletSynced: lastBlockLoading >= blockchainHeight - 1 // Allow 1 block tolerance
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
        const { WalletRepository } = await import('../model/WalletRepository');
        const encryptedWallet = WalletRepository.save(this.wallet, encryptionKey);
        await WalletStorageManager.saveEncryptedWalletData(encryptedWallet);
        
        // Set flag only for password mode (not biometric)
        if (!(await BiometricService.isBiometricChecked())) {
          await SecureStore.setItemAsync('wallet_has_password', 'true');
        }
        
        console.log('WalletService: Wallet saved quietly (no re-authentication)');
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

}
