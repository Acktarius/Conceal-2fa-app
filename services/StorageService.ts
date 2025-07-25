import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface Service {
  id: string;
  name: string;
  issuer: string;
  secret: string;
  isLocalOnly: boolean;
  blockchainTxHash?: string;
  lastSyncAttempt?: number;
}

export class StorageService {
  private static readonly SERVICES_KEY = 'totp_services';
  private static readonly WALLET_KEY = 'wallet_data';
  private static readonly SETTINGS_KEY = 'app_settings';

  static async saveServices(services: Service[]): Promise<void> {
    try {
      const data = JSON.stringify(services);
      if (Platform.OS === 'web') {
        localStorage.setItem(this.SERVICES_KEY, data);
      } else {
        await SecureStore.setItemAsync(this.SERVICES_KEY, data);
      }
    } catch (error) {
      console.error('Error saving services:', error);
      throw new Error('Failed to save services');
    }
  }

  static async getServices(): Promise<Service[]> {
    try {
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(this.SERVICES_KEY);
      } else {
        data = await SecureStore.getItemAsync(this.SERVICES_KEY);
      }
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading services:', error);
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