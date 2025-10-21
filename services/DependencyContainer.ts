/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */

import type { IStorageService } from './interfaces/IStorageService';
import type { IWalletOperations } from './interfaces/IWalletOperations';

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
