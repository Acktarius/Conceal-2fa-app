/**
 * Interface for wallet operations to break circular dependencies
 * This allows modules to call wallet operations without importing WalletService directly
 */

export interface IWalletOperations {
  saveWallet(reason?: string): Promise<void>;
  getWalletSyncStatus(): any;
  signalWalletUpdate(): Promise<void>;
  triggerManualSave(): Promise<void>;
  reinitializeBlockchainExplorer(): Promise<void>;
  getCurrentSessionNodeUrl(): string | null;
  janitor(): void;
  triggerBalanceRefresh(): void;
  sendSmartMessage(action: 'create' | 'delete', sharedKey: any, paymentId?: string): Promise<{success: boolean, txHash?: string}>;
  getWalletBalance(): number;
  isWalletLocal(): boolean;
}

export interface IWalletOperationsProvider {
  setWalletOperations(operations: IWalletOperations): void;
}
