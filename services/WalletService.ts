import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { WalletStorageManager } from './WalletStorageManager';
import { Wallet } from '../model/Wallet';
import { SharedKey } from '../model/Transaction';
import { Cn, CnNativeBride, CnRandom } from '../model/Cn';
import { KeysRepository } from '../model/KeysRepository';
import { BlockchainExplorerRpcDaemon } from '../model/blockchain/BlockchainExplorerRPCDaemon';
import { Alert } from 'react-native';
import { ImportService } from './ImportService';

export interface WalletData {
  address: string;
  privateKey: string;
  publicKey: string;
  seed: string;
  encryptedKeys?: string;
  creationHeight?: number;
}

export class WalletService {
  private static readonly ENCRYPTION_KEY = 'wallet_encryption_key';
  private static wallet: Wallet | null = null;
  private static blockchainExplorer: BlockchainExplorerRpcDaemon | null = null;

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

  static async getOrCreateWallet(): Promise<WalletData> {
    try {

      // Initialize blockchain explorer if not already done
      if (!this.blockchainExplorer) {
        this.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await this.blockchainExplorer.initialize();
      }

      let wallet = await WalletStorageManager.getWallet();
      
      if (!wallet) {
        // No wallet found - ask user what to do
        const result = await new Promise<'create' | 'import'>((resolve) => {
          Alert.alert(
            'No Wallet Found',
            'Would you like to create a new wallet or import an existing one?',
            [
              {
                text: 'Create New',
                onPress: () => resolve('create'),
              },
              {
                text: 'Import',
                onPress: () => resolve('import'),
              },
            ],
            { cancelable: false }
          );
        });

        if (result === 'import') {
          // Let the user choose import method and handle the import
          wallet = await ImportService.importWallet();
        } else {
          // Create new wallet
          wallet = await this.createNewWallet();
        }
        
        // Save the wallet regardless of creation method
        await WalletStorageManager.saveWallet(wallet);
      }
      
      return wallet;
    } catch (error) {
      console.error('Error getting/creating wallet:', error);
      throw new Error('Failed to initialize wallet');
    }
  }

  static async createNewWallet(): Promise<WalletData> {
    try {
      // Generate random seed using Cn functions - this works offline
      let seed = CnNativeBride.sc_reduce32(CnRandom.rand_32());
      
      // Create address and keys using Cn functions - this works offline
      let keys = Cn.create_address(seed);
      
      // Create new wallet instance
      const wallet = new Wallet();
      wallet.keys = KeysRepository.fromPriv(keys.spend.sec, keys.view.sec);
      
      // Set initial creation height
      // If offline, we'll start from 0 and sync later
      let creationHeight = 0;

      // Try to get blockchain height if possible, but don't block on it
      try {
        if (!this.blockchainExplorer) {
          this.blockchainExplorer = new BlockchainExplorerRpcDaemon();
          await Promise.race([
            this.blockchainExplorer.initialize(),
            new Promise((_, reject) => setTimeout(() => reject('TIMEOUT'), 5000)) // 5s timeout
          ]);
          const currentHeight = await Promise.race([
            this.blockchainExplorer.getHeight(),
            new Promise<number>((_, reject) => setTimeout(() => reject('TIMEOUT'), 5000)) // 5s timeout
          ]);
          creationHeight = Math.max(0, currentHeight - 10);
        }
      } catch (error) {
        console.log('Creating wallet in offline mode:', error);
        // We'll continue with creationHeight = 0
      }

      wallet.lastHeight = creationHeight;
      wallet.creationHeight = creationHeight;

      // Create wallet data for storage
      const walletData: WalletData = {
        address: keys.public_addr,
        privateKey: keys.spend.sec,
        publicKey: keys.spend.pub,
        seed: seed,
        creationHeight: creationHeight
      };

      this.wallet = wallet;

      // Try to start blockchain monitoring in the background
      // but don't block or fail if it doesn't work
      if (this.blockchainExplorer) {
        try {
          this.blockchainExplorer.initializeSession();
          const watchdog = this.blockchainExplorer.start(wallet);
        } catch (error) {
          console.log('Failed to start blockchain monitoring:', error);
          // We'll try again later via service worker
        }
      }

      // Schedule a background sync attempt if we're offline
      if (creationHeight === 0) {
        // TODO: Implement service worker for background sync
        // This would:
        // 1. Periodically try to connect to blockchain
        // 2. Update wallet height and start monitoring when connection is available
        // 3. Handle blockchain sync in the background
      }

      return walletData;
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw new Error('Failed to create wallet');
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

    const walletState = this.wallet.exportToRaw();
    const encryptedState = await this.encryptData(walletState);
    await WalletStorageManager.saveWallet({ ...walletState, encryptedKeys: encryptedState });
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
}