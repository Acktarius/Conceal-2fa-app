import { BlockchainExplorerRpcDaemon } from '../model/blockchain/BlockchainExplorerRPCDaemon';
import { StorageService } from './StorageService';
import { WalletService } from './WalletService';
import { Wallet } from '../model/Wallet';

export class BlockchainSyncWorker {
  private static instance: BlockchainSyncWorker | null = null;
  private blockchainExplorer: BlockchainExplorerRpcDaemon | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private wallet: Wallet | null = null;

  // Singleton pattern
  static getInstance(): BlockchainSyncWorker {
    if (!BlockchainSyncWorker.instance) {
      BlockchainSyncWorker.instance = new BlockchainSyncWorker();
    }
    return BlockchainSyncWorker.instance;
  }

  private constructor() {}

  async start() {
    if (this.isRunning) return;

    try {
      // Check if blockchain sync is enabled in settings
      const settings = await StorageService.getSettings();
      if (!settings.blockchainSync) {
        console.log('Blockchain sync is disabled in settings');
        return;
      }

      this.isRunning = true;
      
      // Start periodic sync
      this.syncInterval = setInterval(async () => {
        await this.performSync();
      }, 30000); // Check every 30 seconds

      // Perform initial sync
      await this.performSync();

    } catch (error) {
      console.error('Error starting blockchain sync:', error);
      this.stop();
    }
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    if (this.blockchainExplorer) {
      this.blockchainExplorer.cleanupSession();
      this.blockchainExplorer = null;
    }
  }

  private async performSync() {
    try {
      // Initialize blockchain explorer if needed
      if (!this.blockchainExplorer) {
        this.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await this.blockchainExplorer.initialize();
      }

      // Get current wallet
      if (!this.wallet && WalletService.hasActiveWallet()) {
        const walletData = await StorageService.getWallet();
        if (walletData) {
          this.wallet = Wallet.loadFromRaw(walletData);
        }
      }

      if (!this.wallet) {
        console.log('No wallet available for sync');
        return;
      }

      // Get current blockchain height
      const currentHeight = await this.blockchainExplorer.getHeight();
      
      // If wallet was created offline (height = 0), update it
      if (this.wallet.creationHeight === 0) {
        this.wallet.creationHeight = Math.max(0, currentHeight - 10);
        this.wallet.lastHeight = this.wallet.creationHeight;
        await StorageService.saveWallet(this.wallet.exportToRaw());
      }

      // Start blockchain monitoring if not already started
      if (this.blockchainExplorer && !this.blockchainExplorer.isInitialized()) {
        this.blockchainExplorer.initializeSession();
        const watchdog = this.blockchainExplorer.start(this.wallet);
      }

      // Update sync status in settings
      await StorageService.saveSettings({
        ...await StorageService.getSettings(),
        isWalletSynced: true,
        lastSyncHeight: currentHeight
      });

    } catch (error) {
      console.error('Error during blockchain sync:', error);
      // Update sync status in settings
      await StorageService.saveSettings({
        ...await StorageService.getSettings(),
        isWalletSynced: false
      });
    }
  }

  // Public method to check if wallet is synced
  async isWalletSynced(): Promise<boolean> {
    try {
      const settings = await StorageService.getSettings();
      return settings.isWalletSynced || false;
    } catch (error) {
      return false;
    }
  }
} 