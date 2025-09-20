/**
 * Simple dependency injection container to manage service dependencies
 * and break circular imports
 */

import { IWalletOperations } from './interfaces/IWalletOperations';

class DependencyContainer {
  private walletOperations: IWalletOperations | null = null;

  // Register wallet operations implementation
  registerWalletOperations(operations: IWalletOperations): void {
    this.walletOperations = operations;
  }

  // Get wallet operations (throws if not registered)
  getWalletOperations(): IWalletOperations {
    if (!this.walletOperations) {
      throw new Error('WalletOperations not registered in DependencyContainer');
    }
    return this.walletOperations;
  }

  // Check if wallet operations are registered
  hasWalletOperations(): boolean {
    return this.walletOperations !== null;
  }
}

// Export singleton instance
export const dependencyContainer = new DependencyContainer();
