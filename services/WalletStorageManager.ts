import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export class WalletStorageManager {
  private static readonly WALLET_KEY = 'wallet_data';
  private static readonly ENCRYPTION_KEY = 'wallet_encryption_key';

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

  static async clearWallet(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(this.WALLET_KEY);
        localStorage.removeItem(this.ENCRYPTION_KEY);
      } else {
        await SecureStore.deleteItemAsync(this.WALLET_KEY);
        await SecureStore.deleteItemAsync(this.ENCRYPTION_KEY);
      }
    } catch (error) {
      console.error('Error clearing wallet:', error);
      throw new Error('Failed to clear wallet');
    }
  }
} 