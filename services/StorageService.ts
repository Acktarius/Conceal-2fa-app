import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SharedKey } from '../model/Transaction';
import { WalletStorageManager } from './WalletStorageManager';

export class StorageService {
  private static readonly SHARED_KEYS_KEY = 'shared_keys';
  private static readonly WALLET_KEY = 'wallet_data';
  private static readonly SETTINGS_KEY = 'app_settings';

  static async saveSharedKeys(sharedKeys: SharedKey[]): Promise<void> {
    try {
      const data = JSON.stringify(sharedKeys);
      if (Platform.OS === 'web') {
        localStorage.setItem(this.SHARED_KEYS_KEY, data);
      } else {
        await SecureStore.setItemAsync(this.SHARED_KEYS_KEY, data);
      }
    } catch (error) {
      console.error('Error saving shared keys:', error);
      throw new Error('Failed to save shared keys');
    }
  }

  static async getSharedKeys(): Promise<SharedKey[]> {
    try {
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(this.SHARED_KEYS_KEY);
      } else {
        data = await SecureStore.getItemAsync(this.SHARED_KEYS_KEY);
      }
      
      if (!data) return [];
      
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
          name: item.name || '',
          issuer: item.issuer || '',
          secret: item.secret || '',
          code: item.code || '',
          timeRemaining: item.timeRemaining || 0,
          timeStampSharedKeyCreate: item.timeStampSharedKeyCreate || Date.now()
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
        localStorage.setItem(this.SETTINGS_KEY, data);
      } else {
        await SecureStore.setItemAsync(this.SETTINGS_KEY, data);
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
        data = localStorage.getItem(this.SETTINGS_KEY);
      } else {
        data = await SecureStore.getItemAsync(this.SETTINGS_KEY);
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
        localStorage.removeItem(this.SHARED_KEYS_KEY);
        localStorage.removeItem(this.SETTINGS_KEY);
        localStorage.removeItem('shared_keys');
        localStorage.removeItem('app_settings');
      } else {
        console.log('Clearing native storage...');
        await SecureStore.deleteItemAsync(this.SHARED_KEYS_KEY);
        await SecureStore.deleteItemAsync(this.SETTINGS_KEY);
        await SecureStore.deleteItemAsync('shared_keys');
        await SecureStore.deleteItemAsync('app_settings');
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
      console.log('=== STORAGE DEBUG ===');
      
      // Check shared keys
      const sharedKeys = await this.getSharedKeys();
      console.log('Shared keys count:', sharedKeys.length);
      sharedKeys.forEach((key, index) => {
        console.log(`Shared key ${index}:`, {
          name: key.name,
          issuer: key.issuer,
          hash: key.hash,
          isLocal: key.isLocalOnly()
        });
      });
      
      // Check wallet
      const wallet = await WalletStorageManager.getWallet();
      console.log('Wallet exists:', !!wallet);
      if (wallet) {
        console.log('Wallet address:', wallet.address);
      }
      
      // Check settings
      const settings = await this.getSettings();
      console.log('Settings:', settings);
      
      console.log('=== END STORAGE DEBUG ===');
    } catch (error) {
      console.error('Error debugging storage:', error);
    }
  }
}