/**
 * Interface for storage operations to break circular dependencies
 * This allows modules to call storage operations without importing StorageService directly
 */

import type { SharedKey } from '../../model/Transaction';

export interface IStorageService {
  getSharedKeys(): Promise<SharedKey[]>;
  saveSharedKeys(sharedKeys: SharedKey[]): Promise<void>;
  getSettings(): Promise<any>;
  saveSettings(settings: any): Promise<void>;
  clearAll(): Promise<void>;
}

export interface IStorageServiceProvider {
  setStorageService(service: IStorageService): void;
}
