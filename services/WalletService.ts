import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { WalletStorageManager } from './WalletStorageManager';
import { BiometricService } from './BiometricService';
import { Wallet, RawWallet } from '../model/Wallet';
import { SharedKey } from '../model/Transaction';
import { Cn, CnNativeBride, CnRandom } from '../model/Cn';
import { KeysRepository } from '../model/KeysRepository';
import { BlockchainExplorerRpcDaemon } from '../model/blockchain/BlockchainExplorerRPCDaemon';
import { Alert } from 'react-native';
import { ImportService } from './ImportService';
import { StorageService } from './StorageService';



export class WalletService {
  private static readonly ENCRYPTION_KEY = 'wallet_encryption_key';
  private static wallet: Wallet | null = null;
  private static blockchainExplorer: BlockchainExplorerRpcDaemon | null = null;
  
  // Session flags (reset to false on app launch)
  private static flag_prompt_main_tab = false;
  private static flag_prompt_wallet_tab = false;

  static hasActiveWallet(): boolean {
    return this.wallet !== null;
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

  static async getOrCreateWallet(callerScreen?: 'home' | 'wallet'): Promise<Wallet> {
    try {

      // Initialize blockchain explorer if not already done
      if (!this.blockchainExplorer) {
        this.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await this.blockchainExplorer.initialize();
      }

      // Use already loaded wallet if available, otherwise load it
      let wallet = this.wallet || await WalletStorageManager.getWallet();
      
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
          } else {
            wallet = await this.upgradeToBlockchainWallet();
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
      wallet.keys = { priv: { spend: '', view: '' }, pub: { spend: '', view: '' } }; // This makes it local-only
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
          this.blockchainExplorer = new BlockchainExplorerRpcDaemon();
          await Promise.race([
            this.blockchainExplorer.initialize(),
            new Promise((_, reject) => setTimeout(() => reject('TIMEOUT'), 5000))
          ]);
          const currentHeight = await Promise.race([
            this.blockchainExplorer.getHeight(),
            new Promise<number>((_, reject) => setTimeout(() => reject('TIMEOUT'), 5000))
          ]);
          creationHeight = Math.max(0, currentHeight - 10);
        }
      } catch (error) {
        // We'll continue with creationHeight = 0
      }

      // Upgrade the existing wallet with blockchain data
      const wallet = existingWallet;
      wallet.keys = { 
        priv: { spend: keys.spend.sec, view: keys.view.sec }, 
        pub: { spend: keys.spend.pub, view: keys.view.pub } 
      };
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

      // Try to start blockchain monitoring in the background
      if (this.blockchainExplorer) {
        try {
          this.blockchainExplorer.initializeSession();
          const watchdog = this.blockchainExplorer.start(wallet);
        } catch (error) {
          // We'll try again later via service worker
        }
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
   * 1. Stops active node connections
   * 2. Cleans up the blockchain monitoring session
   * 3. Releases memory resources
   * 
   * Call this when:
   * - User logs out
   * - App goes to background
   * - Wallet component unmounts
   */
  static async cleanupWallet(): Promise<void> {
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
  /*
  static async clearStoredWalletForTesting(): Promise<void> {
    try {
      console.log('TESTING: Clearing stored wallet...');
      await WalletStorageManager.clearWallet();
      console.log('TESTING: Stored wallet cleared successfully');
    } catch (error) {
      console.error('TESTING: Error clearing stored wallet:', error);
      throw error;
    }
  }
  */


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
        return await ImportService.importWallet();
      } else {
        return await this.upgradeToBlockchainWallet();
      }
    } catch (error) {
      console.error('Error triggering wallet upgrade:', error);
      throw error;
    }
  }

}
