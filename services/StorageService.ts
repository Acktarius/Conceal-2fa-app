import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SharedKey } from '../models/Transaction';

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

  static async saveWallet(walletData: any): Promise<void> {
    try {
      const data = JSON.stringify(walletData);
      if (Platform.OS === 'web') {
        localStorage.setItem(this.WALLET_KEY, data);
      } else {
        await SecureStore.setItemAsync(this.WALLET_KEY, data);
      }
    } catch (error) {
      console.error('Error saving wallet:', error);
      throw new Error('Failed to save wallet');
    }
  }

  static async getWallet(): Promise<any | null> {
    try {
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(this.WALLET_KEY);
      } else {
        data = await SecureStore.getItemAsync(this.WALLET_KEY);
      }
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading wallet:', error);
      return null;
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
      if (Platform.OS === 'web') {
        localStorage.removeItem(this.SERVICES_KEY);
        localStorage.removeItem(this.WALLET_KEY);
        localStorage.removeItem(this.SETTINGS_KEY);
      } else {
        await SecureStore.deleteItemAsync(this.SERVICES_KEY);
        await SecureStore.deleteItemAsync(this.WALLET_KEY);
        await SecureStore.deleteItemAsync(this.SETTINGS_KEY);
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw new Error('Failed to clear storage');
    }
  }
}