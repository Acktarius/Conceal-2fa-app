/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export class BiometricService {
  private static readonly SETTINGS_KEY = 'app_settings';

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

  static async isBiometricEnabled(): Promise<boolean> {
    try {
      // Read settings directly to avoid circular dependency
      let settings: any = {};
      if (Platform.OS === 'web') {
        const data = localStorage.getItem(BiometricService.SETTINGS_KEY);
        if (data) {
          settings = JSON.parse(data);
        }
      } else {
        const data = await SecureStore.getItemAsync(BiometricService.SETTINGS_KEY);
        if (data) {
          settings = JSON.parse(data);
        }
      }
      return settings.biometricAuth !== false; // Default to true unless explicitly set to false
    } catch (error) {
      console.error('Error checking biometric enabled status:', error);
      return false;
    }
  }

  static async isBiometricChecked(): Promise<boolean> {
    const isBiometricAvailable = await BiometricService.isBiometricAvailable();
    const isBiometricEnabled = await BiometricService.isBiometricEnabled();
    return isBiometricAvailable && isBiometricEnabled;
  }

  static async authenticateWithBiometric(): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false, // Allow PIN fallback for better user experience
      });
      return result.success;
    } catch (error) {
      console.error('Error in biometric authentication:', error);
      return false;
    }
  }
}
