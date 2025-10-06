/**
 * Simple dependency injection container to manage service dependencies
 * and break circular imports
 */

import { IWalletOperations } from './interfaces/IWalletOperations';
import { IStorageService } from './interfaces/IStorageService';

class DependencyContainer {
  private walletOperations: IWalletOperations | null = null;
  private storageService: IStorageService | null = null;

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

  // Register storage service implementation
  registerStorageService(service: IStorageService): void {
    this.storageService = service;
  }

  // Get storage service (throws if not registered)
  getStorageService(): IStorageService {
    if (!this.storageService) {
      throw new Error('StorageService not registered in DependencyContainer');
    }
    return this.storageService;
  }

  // Check if storage service is registered
  hasStorageService(): boolean {
    return this.storageService !== null;
  }
}

// Export singleton instance
export const dependencyContainer = new DependencyContainer();
