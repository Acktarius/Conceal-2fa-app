import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { Platform, Alert } from 'react-native';
import { WalletRepository } from '../model/WalletRepository';
import { Wallet } from '../model/Wallet';
import { BiometricService } from './BiometricService';

export class WalletStorageManager {
  private static readonly WALLET_KEY = 'wallet_data';
  private static readonly ENCRYPTION_KEY = 'wallet_encryption_key';
  private static readonly WALLET_HAS_PASSWORD_KEY = 'wallet_has_password';
  private static readonly BIOMETRIC_SALT_KEY = 'biometric_salt';

  private static async saveEncryptedWalletData(encryptedData: any): Promise<void> {
    try {
      const data = JSON.stringify(encryptedData);
      if (Platform.OS === 'web') {
        localStorage.setItem(this.WALLET_KEY, data);
      } else {
        await AsyncStorage.setItem(this.WALLET_KEY, data);
      }
    } catch (error) {
      console.error('Error saving encrypted wallet:', error);
      throw new Error('Failed to save encrypted wallet');
    }
  }

  static async getWallet(): Promise<Wallet | null> {
    try {
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(this.WALLET_KEY);
      } else {
        data = await AsyncStorage.getItem(this.WALLET_KEY);
      }
      
      if (!data) return null;
      
      const parsedData = JSON.parse(data);
      
      // Check if this is encrypted data (has 'data' and 'nonce' properties)
      if (parsedData.data && parsedData.nonce) {
        console.log('Found encrypted wallet data, checking authentication mode...');
        
        const isBiometricEnabled = await BiometricService.isBiometricEnabled();
        console.log('Authentication mode:', isBiometricEnabled ? 'BIOMETRIC' : 'PASSWORD');
        
        if (isBiometricEnabled) {
          // Biometric mode: authenticate with biometric and decrypt with biometric key
          return await this.authenticateWithBiometric();
        } else {
          // Password mode: prompt for password and decrypt with password
          return await this.authenticateWithPassword();
        }
      }
      
      // Unencrypted data is not allowed - this is a security violation
      console.error('SECURITY VIOLATION: Found unencrypted wallet data!');
      console.error('All wallet data must be encrypted at rest. Clearing unencrypted data.');
      
      // Clear the unencrypted data immediately
      await this.clearWallet();
      
      // Return null - user will need to create a new wallet
      return null;
    } catch (error) {
      console.error('Error loading wallet:', error);
      return null;
    }
  }

  private static async authenticateWithBiometric(): Promise<Wallet | null> {
    try {
      console.log('BIOMETRIC: Starting biometric authentication...');
      
      // Check if biometric salt exists
      const biometricSalt = await this.getBiometricSalt();
      if (!biometricSalt) {
        console.log('BIOMETRIC: No biometric salt found, falling back to password');
        return await this.authenticateWithPassword();
      }
      
      // Authenticate with biometric
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: true, // SECURITY: Disable fallback to prevent bypass
      });
      
      if (result.success) {
        console.log('BIOMETRIC: Authentication successful, decrypting wallet...');
        const wallet = await this.getDecryptedWalletWithBiometric();
        if (wallet) {
          console.log('BIOMETRIC: Wallet decrypted successfully');
          return wallet;
        } else {
          console.log('BIOMETRIC: Wallet decryption failed');
          return null;
        }
      } else {
        console.log('BIOMETRIC: Authentication failed');
        return null;
      }
    } catch (error) {
      console.error('BIOMETRIC: Error in biometric authentication:', error);
      return null;
    }
  }

  private static async authenticateWithPassword(): Promise<Wallet | null> {
    try {
      console.log('PASSWORD: Starting password authentication...');
      
      // Prompt for password using the global context
      const passwordPromptContext = (global as any).passwordPromptContext;
      if (!passwordPromptContext) {
        throw new Error('Password prompt context not available. App must be properly initialized.');
      }
      
      const password = await passwordPromptContext.showPasswordPromptAlert(
        'Wallet Password Required', 
        'Enter your wallet password to access the app:'
      );
      
      if (!password) {
        console.log('PASSWORD: No password provided');
        return null;
      }
      
      console.log('PASSWORD: Password provided, decrypting wallet...');
      const wallet = await this.getDecryptedWalletWithPassword(password);
      if (wallet) {
        console.log('PASSWORD: Wallet decrypted successfully');
        return wallet;
      } else {
        console.log('PASSWORD: Wallet decryption failed - invalid password');
        return null;
      }
    } catch (error) {
      console.error('PASSWORD: Error in password authentication:', error);
      return null;
    }
  }

  static async clearWallet(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(this.WALLET_KEY);
        localStorage.removeItem(this.ENCRYPTION_KEY);
        localStorage.removeItem(this.WALLET_HAS_PASSWORD_KEY);
        localStorage.removeItem(this.BIOMETRIC_SALT_KEY);
      } else {
        await AsyncStorage.removeItem(this.WALLET_KEY);
        await SecureStore.deleteItemAsync(this.ENCRYPTION_KEY);
        await SecureStore.deleteItemAsync(this.WALLET_HAS_PASSWORD_KEY);
        await SecureStore.deleteItemAsync(this.BIOMETRIC_SALT_KEY);
      }
    } catch (error) {
      console.error('Error clearing wallet:', error);
      throw new Error('Failed to clear wallet');
    }
  }

  // Methods that use WalletRepository for encryption/decryption
  static async saveEncryptedWallet(wallet: Wallet, password: string): Promise<void> {
    try {
      const encryptedWallet = WalletRepository.save(wallet, password);
      await this.saveEncryptedWalletData(encryptedWallet);
      await SecureStore.setItemAsync(this.WALLET_HAS_PASSWORD_KEY, 'true');
    } catch (error) {
      console.error('Error saving encrypted wallet:', error);
      throw new Error('Failed to save encrypted wallet');
    }
  }

  static async getEncryptedWallet(password: string): Promise<Wallet | null> {
    try {
      const walletData = await this.getWallet();
      return WalletRepository.getLocalWalletWithPassword(password, walletData);
    } catch (error) {
      console.error('Error getting encrypted wallet:', error);
      return null;
    }
  }

  static async getDecryptedWalletWithPassword(password: string): Promise<Wallet | null> {
    try {
      // Get raw encrypted data directly, bypassing authentication
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(this.WALLET_KEY);
      } else {
        data = await AsyncStorage.getItem(this.WALLET_KEY);
      }
      
      if (!data) return null;
      
      const parsedData = JSON.parse(data);
      
      // Check if this is encrypted data (has 'data' and 'nonce' properties)
      if (parsedData.data && parsedData.nonce) {
        // Directly decrypt with provided password
        return WalletRepository.decodeWithPassword(parsedData, password);
      }
      
      // Unencrypted data is not allowed - this is a security violation
      console.error('SECURITY VIOLATION: Found unencrypted wallet data in getDecryptedWalletWithPassword!');
      return null;
    } catch (error) {
      console.error('Error getting decrypted wallet with password:', error);
      return null;
    }
  }

  static async getDecryptedWalletWithBiometric(): Promise<Wallet | null> {
    try {
      // Get raw encrypted data directly
      let data: string | null;
      if (Platform.OS === 'web') {
        data = localStorage.getItem(this.WALLET_KEY);
      } else {
        data = await AsyncStorage.getItem(this.WALLET_KEY);
      }
      
      if (!data) return null;
      
      const parsedData = JSON.parse(data);
      
      // Check if this is encrypted data (has 'data' and 'nonce' properties)
      if (parsedData.data && parsedData.nonce) {
        // Derive biometric key from device capabilities + salt
        const biometricKey = await this.deriveBiometricKey();
        if (!biometricKey) {
          return null;
        }
        
        // Decrypt with derived biometric key
        console.log('BIOMETRIC DECRYPT: Attempting to decrypt with derived key...');
        try {
          const result = WalletRepository.decodeWithPassword(parsedData, biometricKey);
          console.log('BIOMETRIC DECRYPT: Decryption successful:', !!result);
          return result;
        } catch (error) {
          console.log('BIOMETRIC DECRYPT: Decryption failed:', error.message);
          return null;
        }
      }
      
      // Unencrypted data is not allowed - this is a security violation
      console.error('SECURITY VIOLATION: Found unencrypted wallet data in getDecryptedWalletWithBiometric!');
      return null;
    } catch (error) {
      console.error('Error getting decrypted wallet with biometric:', error);
      return null;
    }
  }

  static async hasStoredWallet(): Promise<boolean> {
    try {
      const walletData = await this.getWallet();
      return walletData !== null;
    } catch (error) {
      console.error('Error checking for stored wallet:', error);
      return false;
    }
  }

  // Biometric authentication methods
  static async isBiometricAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }


  static async walletHasPassword(): Promise<boolean> {
    try {
      const hasPassword = await SecureStore.getItemAsync(this.WALLET_HAS_PASSWORD_KEY);
      return hasPassword === 'true';
    } catch (error) {
      console.error('Error checking wallet password status:', error);
      return false;
    }
  }


  static async getWalletWithBiometric(): Promise<Wallet | null> {
    try {
      const isBiometricEnabled = await BiometricService.isBiometricEnabled();
      if (!isBiometricEnabled) {
        return null;
      }

      // Authenticate with biometric
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const wallet = await this.getWallet();
        if (wallet) {
          return wallet;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting wallet with biometric:', error);
      return null;
    }
  }

  static async authenticateAndGetWallet(): Promise<Wallet | null> {
    try {
      const isBiometricEnabled = await BiometricService.isBiometricEnabled();
      
      if (isBiometricEnabled) {
        // Try biometric first
        const wallet = await this.getWalletWithBiometric();
        if (wallet) {
          return wallet;
        }
        // Biometric failed, fallback to password
      }
      
      // Require password authentication
      return new Promise((resolve) => {
        Alert.prompt(
          'Wallet Password',
          'Enter your wallet password:',
          [
            {
              text: 'Cancel',
              onPress: () => resolve(null),
              style: 'cancel',
            },
            {
              text: 'Unlock',
              onPress: async (password) => {
                if (!password) {
                  Alert.alert('Error', 'Password is required');
                  resolve(null);
                  return;
                }
                
                const wallet = await this.getEncryptedWallet(password);
                resolve(wallet);
              },
            },
          ],
          'secure-text'
        );
      });
    } catch (error) {
      console.error('Error in authentication:', error);
      return null;
    }
  }


  // New biometric salt methods
  static async generateAndStoreBiometricSalt(userPassword: string): Promise<void> {
    try {
      // Generate a salt derived from the user password
      const salt = await this.deriveSaltFromPassword(userPassword);
      await SecureStore.setItemAsync(this.BIOMETRIC_SALT_KEY, salt);
    } catch (error) {
      console.error('Error generating biometric salt:', error);
      throw new Error('Failed to generate biometric salt');
    }
  }

  static async getBiometricSalt(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(this.BIOMETRIC_SALT_KEY);
    } catch (error) {
      console.error('Error getting biometric salt:', error);
      return null;
    }
  }

  private static async deriveSaltFromPassword(password: string): Promise<string> {
    // Simple salt derivation using expo-crypto
    const data = password + 'biometric_salt';
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
  }

  static async deriveBiometricKey(): Promise<string | null> {
    try {
      console.log('BIOMETRIC KEY: Starting key derivation...');
      const salt = await this.getBiometricSalt();
      console.log('BIOMETRIC KEY: Salt available:', !!salt);
      if (!salt) {
        console.log('BIOMETRIC KEY: No salt found');
        return null;
      }
      
      // Generate a consistent biometric identifier based on device capabilities
      // This creates a unique key per device/user combination
      const biometricIdentifier = await this.generateBiometricIdentifier();
      console.log('BIOMETRIC KEY: Generated biometric identifier');
      
      // Derive key from biometric identifier + salt using expo-crypto
      const data = biometricIdentifier + salt;
      const key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
      console.log('BIOMETRIC KEY: Key derived successfully');
      return key;
    } catch (error) {
      console.error('BIOMETRIC KEY: Error deriving biometric key:', error);
      return null;
    }
  }

  private static async generateBiometricIdentifier(): Promise<string> {
    try {
      // Get device-specific information to create a unique identifier
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      // Create a consistent identifier based on device capabilities
      const deviceInfo = {
        hasHardware,
        isEnrolled,
        supportedTypes: supportedTypes.sort(), // Sort for consistency
        platform: Platform.OS,
        // Add a device-specific constant (this could be enhanced with device ID)
        deviceConstant: 'conceal_wallet_biometric'
      };
      
      const identifierString = JSON.stringify(deviceInfo);
      return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, identifierString);
    } catch (error) {
      console.error('Error generating biometric identifier:', error);
      // Fallback to a simple identifier
      return 'fallback_biometric_identifier';
    }
  }

  private static async promptForPassword(message: string): Promise<string | null> {
    return new Promise((resolve) => {
      Alert.prompt(
        'Wallet Password Required',
        message,
        [
          {
            text: 'Cancel',
            onPress: () => resolve(null),
            style: 'cancel',
          },
          {
            text: 'Unlock',
            onPress: (password) => {
              if (!password) {
                resolve(null);
              } else {
                resolve(password);
              }
            },
          },
        ],
        'secure-text'
      );
    });
  }
} 