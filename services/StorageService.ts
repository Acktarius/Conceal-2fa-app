/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SharedKey } from '../model/Transaction';
import { dependencyContainer } from './DependencyContainer';
import type { IStorageService } from './interfaces/IStorageService';
import { WalletStorageManager } from './WalletStorageManager';

export class StorageService implements IStorageService {
  private static readonly SHARED_KEYS_KEY = 'shared_keys';
  private static readonly WALLET_KEY = 'wallet_data';
  private static readonly SETTINGS_KEY = 'app_settings';
  private static readonly ENCRYPTION_SALT = 'conceal_shared_keys_salt';

  // Register this service in the dependency container
  static registerInContainer(): void {
    dependencyContainer.registerStorageService(new StorageService());
  }

  // Instance methods for IStorageService interface
  async getSharedKeys(): Promise<SharedKey[]> {
    return StorageService.getSharedKeys();
  }

  async saveSharedKeys(sharedKeys: SharedKey[]): Promise<void> {
    return StorageService.saveSharedKeys(sharedKeys);
  }

  async getSettings(): Promise<any> {
    return StorageService.getSettings();
  }

  async saveSettings(settings: any): Promise<void> {
    return StorageService.saveSettings(settings);
  }

  async clearAll(): Promise<void> {
    return StorageService.clearAll();
  }

  // TEMPORARY: Simple encryption for shared keys
  // TODO: Remove these functions when shared keys are integrated into transactions
  // Shared keys should use WalletRepository encryption like wallet data
  private static async encryptData(data: string): Promise<string> {
    const combined = data + StorageService.ENCRYPTION_SALT;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, combined);
    return btoa(data + '|' + hash);
  }

  // TEMPORARY: Simple decryption for shared keys
  private static async decryptData(encryptedData: string): Promise<string> {
    const decoded = atob(encryptedData);
    const [data, hash] = decoded.split('|');

    // Verify the data integrity
    const combined = data + StorageService.ENCRYPTION_SALT;
    const expectedHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, combined);

    if (hash !== expectedHash) {
      throw new Error('Invalid encrypted data');
    }

    return data;
  }

  static async saveSharedKeys(sharedKeys: SharedKey[]): Promise<void> {
    try {
      const data = JSON.stringify(sharedKeys);
      const encryptedData = await StorageService.encryptData(data);

      if (Platform.OS === 'web') {
        localStorage.setItem(StorageService.SHARED_KEYS_KEY, encryptedData);
      } else {
        // Use SecureStore for better persistence
        await SecureStore.setItemAsync(StorageService.SHARED_KEYS_KEY, encryptedData);
      }
    } catch (error) {
      console.error('Error saving shared keys:', error);
      throw new Error('Failed to save shared keys');
    }
  }

  // Migration: Check if shared keys exist in AsyncStorage and migrate to SecureStore
  private static async migrateSharedKeysIfNeeded(): Promise<void> {
    // Only run migration on native platforms (not web)
    if (Platform.OS === 'web') return;

    try {
      // First check if we already have valid data in SecureStore
      const existingData = await SecureStore.getItemAsync(StorageService.SHARED_KEYS_KEY);
      if (existingData && existingData.length > 0) {
        // Already migrated and has data - try to decrypt to verify it's valid
        try {
          await StorageService.decryptData(existingData);
          // Valid data exists in SecureStore
          return;
        } catch {
          // Invalid data in SecureStore - will try to migrate from AsyncStorage
          console.log('StorageService: Invalid data in SecureStore, will try migration');
        }
      }

      // Check for old data in AsyncStorage
      const oldData = await AsyncStorage.getItem(StorageService.SHARED_KEYS_KEY);
      if (oldData && oldData.length > 0) {
        console.log('StorageService: Migrating shared keys from AsyncStorage to SecureStore');

        // Try to migrate - first verify if it's encrypted or plain JSON
        try {
          // Try to decrypt as encrypted data
          await StorageService.decryptData(oldData);
          // It's encrypted - migrate directly
          await SecureStore.setItemAsync(StorageService.SHARED_KEYS_KEY, oldData);
        } catch {
          // It's plain JSON - encrypt before saving
          const encryptedData = await StorageService.encryptData(oldData);
          await SecureStore.setItemAsync(StorageService.SHARED_KEYS_KEY, encryptedData);
        }

        // Delete from AsyncStorage after successful migration
        await AsyncStorage.removeItem(StorageService.SHARED_KEYS_KEY);

        console.log('StorageService: Migration complete - shared keys moved to SecureStore');
      }
    } catch (error) {
      console.error('StorageService: Error during migration:', error);
      // Don't throw - let the app try to continue
    }
  }

  static async getSharedKeys(): Promise<SharedKey[]> {
    try {
      // Migration: Check if shared keys exist in AsyncStorage and migrate to SecureStore
      await StorageService.migrateSharedKeysIfNeeded();

      let encryptedData: string | null;
      if (Platform.OS === 'web') {
        encryptedData = localStorage.getItem(StorageService.SHARED_KEYS_KEY);
      } else {
        // Read from SecureStore for persistence
        encryptedData = await SecureStore.getItemAsync(StorageService.SHARED_KEYS_KEY);
      }

      if (!encryptedData) return [];

      const data = await StorageService.decryptData(encryptedData);
      const parsed = JSON.parse(data);
      return parsed.map((item: any) => {
        const sharedKey = new SharedKey();
        // Use Object.assign to copy all properties from the stored item
        Object.assign(sharedKey, {
          hash: item.hash || '',
          amount: item.amount || 0,
          fee: item.fee || 0,
          extraType: item.extraType || '',
          revokeInQueue: item.revokeInQueue || false,
          toBePush: item.toBePush || false, // Include toBePush property
          name: item.name || '',
          issuer: item.issuer || '',
          secret: item.secret || '',
          algorithm: item.algorithm === 'SHA256' || item.algorithm === 'SHA512' ? item.algorithm : 'SHA1',
          digits: item.digits === 7 || item.digits === 8 ? item.digits : 6,
          period: item.period === 60 ? 60 : 30,
          code: item.code || '',
          timeRemaining: item.timeRemaining || 0,
          timeStampSharedKeyCreate: item.timeStampSharedKeyCreate || Date.now(),
          timeStampSharedKeyRevoke: item.timeStampSharedKeyRevoke !== undefined ? item.timeStampSharedKeyRevoke : -1, // Include timeStampSharedKeyRevoke property
          isLocal: item.isLocal !== undefined ? item.isLocal : true, // Default to true for backward compatibility
          unknownSource: item.unknownSource || false, // Default to false for backward compatibility
        });
        return sharedKey;
      });
    } catch (error) {
      console.error('Error loading shared keys:', error);
      return [];
    }
  }

  static async saveSettings(settings: any): Promise<void> {
    try {
      const data = JSON.stringify(settings);
      if (Platform.OS === 'web') {
        localStorage.setItem(StorageService.SETTINGS_KEY, data);
      } else {
        await SecureStore.setItemAsync(StorageService.SETTINGS_KEY, data);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  static async getSettings(): Promise<any> {
    try {
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(StorageService.SETTINGS_KEY);
      } else {
        data = await SecureStore.getItemAsync(StorageService.SETTINGS_KEY);
      }
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error loading settings:', error);
      return {};
    }
  }

  static async clearAll(): Promise<void> {
    try {
      console.log('Starting clearAll...');

      if (Platform.OS === 'web') {
        console.log('Clearing web storage...');
        // Clear all known keys
        localStorage.removeItem(StorageService.SHARED_KEYS_KEY);
        localStorage.removeItem(StorageService.SETTINGS_KEY);
        localStorage.removeItem('shared_keys');
        localStorage.removeItem('app_settings');
        localStorage.removeItem('wallet_data');
        localStorage.removeItem('wallet_encryption_key');
        localStorage.removeItem('wallet_has_password');
        // Clear any other possible keys
        localStorage.clear();
      } else {
        console.log('Clearing native storage...');
        // Clear all known keys from SecureStore
        await SecureStore.deleteItemAsync(StorageService.SHARED_KEYS_KEY);
        await SecureStore.deleteItemAsync(StorageService.SETTINGS_KEY);
        await SecureStore.deleteItemAsync('shared_keys');
        await SecureStore.deleteItemAsync('app_settings');
        await SecureStore.deleteItemAsync('wallet_data');
        await SecureStore.deleteItemAsync('wallet_encryption_key');
        await SecureStore.deleteItemAsync('wallet_has_password');
      }

      // Clear wallet data
      await WalletStorageManager.clearWallet();

      console.log('ClearAll completed successfully');
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw new Error('Failed to clear storage');
    }
  }

  static async debugStorage(): Promise<void> {
    try {
      // No-op: debug logging removed. Callers (e.g. SettingsScreen) may still invoke this.
    } catch (error) {
      console.error('Error debugging storage:', error);
    }
  }
}
