import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import Header from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import { useWallet } from '../contexts/WalletContext';
import GestureNavigator from '../components/GestureNavigator';
import { StorageService } from '../services/StorageService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlockchainSyncWorker } from '../services/BlockchainSyncWorker';
import { WalletService } from '../services/WalletService';
import { Mnemonic } from '../model/Mnemonic';
import { PasswordChangeAlert } from '../components/PasswordChangeAlert';
import { UnlockWalletAlert } from '../components/UnlockWalletAlert';
import { PasswordCreationAlert } from '../components/PasswordCreationAlert';
import { WalletStorageManager } from '../services/WalletStorageManager';
import { ExportService } from '../services/ExportService';
import * as SecureStore from 'expo-secure-store';
// verifyOldPassword function moved here to avoid circular dependencies

type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const [blockchainSync, setBlockchainSync] = useState(false);
  const [autoShare, setAutoShare] = useState(false);
  const [biometricAuth, setBiometricAuth] = useState(false);
  const [showPasswordChangeAlert, setShowPasswordChangeAlert] = useState(false);
  const [showUnlockWalletAlert, setShowUnlockWalletAlert] = useState(false);
  const [showPasswordCreationAlert, setShowPasswordCreationAlert] = useState(false);
  const [biometricAction, setBiometricAction] = useState<'enable' | 'disable'>('enable');
  
  // Expandable sections state
  const [showRecoverySeed, setShowRecoverySeed] = useState(false);
  const [showExportQR, setShowExportQR] = useState(false);
  const [recoverySeed, setRecoverySeed] = useState('');
  const [exportQRData, setExportQRData] = useState('');
  
  // Calculate QR code size based on screen width
  const screenWidth = Dimensions.get('window').width;
  const cardPadding = 16; // 8px padding on each side of the card
  const expandablePadding = 16; // 8px padding on each side of expandable section
  const maxQRWidth = (screenWidth - cardPadding - expandablePadding) * 0.95;
  const qrSize = Math.min(maxQRWidth, 250); // Cap at 250px for readability
  
  const { theme, toggleTheme, isDark } = useTheme();
  const { wallet, refreshWallet } = useWallet();
  const navigation = useNavigation<NavigationProp>();

  const styles = createStyles(theme, isDark);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await StorageService.getSettings();
      setBlockchainSync(settings.blockchainSync || false);
      setAutoShare(settings.autoShare || false);
      // Enable biometric auth by default since we're using it
      setBiometricAuth(settings.biometricAuth !== false); // Default to true unless explicitly set to false
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleBlockchainSyncToggle = async (value: boolean) => {
    try {
      setBlockchainSync(value);
      await StorageService.saveSettings({
        ...await StorageService.getSettings(),
        blockchainSync: value
      });

      // Start or stop blockchain sync worker
      const syncWorker = BlockchainSyncWorker.getInstance();
      if (value) {
        await syncWorker.start();
      } else {
        syncWorker.stop();
      }
    } catch (error) {
      console.error('Error toggling blockchain sync:', error);
      // Revert the toggle if there was an error
      setBlockchainSync(!value);
    }
  };

  const handleShowSeed = () => {
    if (showRecoverySeed) {
      // Collapse the section
      setShowRecoverySeed(false);
      setRecoverySeed('');
    } else {
      // Expand and generate seed
      if (wallet?.keys?.priv?.spend) {
        try {
          // Derive seed from private key using Mnemonic.mn_encode()
          const mnemonic = Mnemonic.mn_encode(wallet.keys.priv.spend, 'english');
          setRecoverySeed(mnemonic);
          setShowRecoverySeed(true);
        } catch (error) {
          Alert.alert('Error', 'Failed to generate recovery seed from wallet keys.');
        }
      } else {
        Alert.alert('Error', 'No wallet keys available to generate seed.');
      }
    }
  };

  const handleExportWallet = () => {
    if (showExportQR) {
      // Collapse the section
      setShowExportQR(false);
      setExportQRData('');
    } else {
      // Expand and generate QR
      if (!wallet) {
        Alert.alert('Error', 'No wallet available for export');
        return;
      }

      if (wallet.isLocal()) {
        Alert.alert('Error', 'Cannot export local-only wallet. Please upgrade to blockchain wallet first.');
        return;
      }

      try {
        const qrData = ExportService.exportWalletAsQR(wallet);
        setExportQRData(qrData);
        setShowExportQR(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to export wallet QR code. Please try again.');
      }
    }
  };

  const handleCopySeed = async () => {
    try {
      await Clipboard.setStringAsync(recoverySeed);
      Alert.alert('Copied', 'Recovery seed copied to clipboard!');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy seed.');
    }
  };

  const handleCopyQRData = async () => {
    try {
      await Clipboard.setStringAsync(exportQRData);
      Alert.alert('Copied', 'QR code data copied to clipboard!');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy QR data.');
    }
  };

  const handleClearData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will remove all services and wallet data. This action cannot be undone.',
      [
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('=== BEFORE CLEAR ===');
              await StorageService.debugStorage();
              
              await WalletService.forceClearAll();
              
              // Reset upgrade prompt flags so new local wallet can show prompts
              await WalletService.resetUpgradeFlags();
              
              console.log('=== AFTER CLEAR ===');
              await StorageService.debugStorage();
              
              // Clear the wallet context state to force reinitialization
              await refreshWallet();
              
              // Navigate to HomeScreen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            } catch (error) {
              console.error('Error in handleClearData:', error);
              Alert.alert(
                'Error',
                'Failed to clear data. Please try again.',
                [{ text: 'OK' }]
              );
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handlePasswordChange = async (oldPassword: string, newPassword: string) => {
    try {
      // Safety check: password change should only be available when biometric is disabled
      if (biometricAuth) {
        Alert.alert('Error', 'Password change is only available when biometric authentication is disabled');
        return;
      }
      
      // 1. Get the current wallet with the old password (this also verifies the password)
      const currentWallet = await WalletStorageManager.getDecryptedWalletWithPassword(oldPassword);
      if (!currentWallet) {
        Alert.alert('Error', 'Current password is incorrect or could not retrieve wallet data');
        return;
      }
      
      // 2. Re-encrypt the wallet with the new password
      await WalletStorageManager.saveEncryptedWallet(currentWallet, newPassword);
      
      // Note: No need to update biometric salt since we're in password mode
      // Biometric salt is only relevant when biometric authentication is enabled
      
      Alert.alert('Success', 'Password changed successfully');
      setShowPasswordChangeAlert(false);
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'Failed to change password. Please try again.');
    }
  };

  const handleEnableBiometric = async (password: string) => {
    try {
      // 1. Verify the password by trying to decrypt the wallet
      const currentWallet = await WalletStorageManager.getDecryptedWalletWithPassword(password);
      if (!currentWallet) {
        Alert.alert('Error', 'Password is incorrect');
        return;
      }
      
      // 2. Generate and store biometric salt with the verified password
      await WalletStorageManager.generateAndStoreBiometricSalt(password);
      
      // 3. Re-encrypt the wallet with the derived biometric key
      const biometricKey = await WalletStorageManager.deriveBiometricKey();
      if (!biometricKey) {
        Alert.alert('Error', 'Failed to generate biometric key');
        return;
      }
      
      // Re-encrypt wallet with biometric key
      await WalletStorageManager.saveEncryptedWallet(currentWallet, biometricKey);
      
      // 4. Enable biometric authentication in settings
      setBiometricAuth(true);
      await StorageService.saveSettings({
        ...await StorageService.getSettings(),
        biometricAuth: true
      });
      
      Alert.alert('Success', 'Biometric authentication enabled successfully');
      setShowUnlockWalletAlert(false);
    } catch (error) {
      console.error('Error enabling biometric:', error);
      Alert.alert('Error', 'Failed to enable biometric authentication. Please try again.');
    }
  };

  const handleDisableBiometric = async (newPassword: string) => {
    try {
      // 1. Get the current wallet (it's encrypted with biometric key)
      const biometricKey = await WalletStorageManager.deriveBiometricKey();
      if (!biometricKey) {
        Alert.alert('Error', 'Failed to derive biometric key');
        return;
      }
      
      const currentWallet = await WalletStorageManager.getDecryptedWalletWithPassword(biometricKey);
      if (!currentWallet) {
        Alert.alert('Error', 'Could not decrypt wallet with biometric key');
        return;
      }
      
      // 2. Re-encrypt the wallet with the NEW user password
      await WalletStorageManager.saveEncryptedWallet(currentWallet, newPassword);
      
      // 3. Disable biometric authentication in settings
      setBiometricAuth(false);
      await StorageService.saveSettings({
        ...await StorageService.getSettings(),
        biometricAuth: false
      });
      
      Alert.alert('Success', 'Biometric authentication disabled. You will now use password authentication.');
      setShowPasswordCreationAlert(false);
    } catch (error) {
      console.error('Error disabling biometric:', error);
      Alert.alert('Error', 'Failed to disable biometric authentication. Please try again.');
    }
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightElement 
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={icon as any} size={24} color={theme.colors.text} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement || (onPress && <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />)}
    </TouchableOpacity>
  );

  return (
    <GestureNavigator>
      <View style={styles.container}>
        <Header title="Settings" />
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Appearance Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <SettingItem
                icon="moon-outline"
                title="Dark Mode"
                subtitle="Toggle dark/light theme"
                rightElement={
                  <Switch
                    value={isDark}
                    onValueChange={toggleTheme}
                    trackColor={{ 
                      false: theme.colors.border,
                      true: theme.colors.primary
                    }}
                    thumbColor={theme.colors.background}
                    ios_backgroundColor={theme.colors.border}
                  />
                }
              />
            </View>
          </View>

          {/* Wallet Management */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Wallet Management</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <SettingItem
                icon="key-outline"
                title="Show Recovery Seed"
                subtitle={showRecoverySeed ? "Hide recovery phrase" : "View your 25-word recovery phrase"}
                onPress={handleShowSeed}
                rightElement={
                  <Ionicons 
                    name={showRecoverySeed ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={theme.colors.textSecondary} 
                  />
                }
              />
              
              {/* Recovery Seed Expandable Section */}
              {showRecoverySeed && (
                <View style={[styles.expandableSection, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.seedText, { color: theme.colors.text, backgroundColor: theme.colors.surface }]}>
                    {recoverySeed}
                  </Text>
                  <TouchableOpacity
                    style={[styles.copyButton, { backgroundColor: theme.colors.primaryLight }]}
                    onPress={handleCopySeed}
                  >
                    <Ionicons name="copy-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.copyButtonText, { color: theme.colors.primary }]}>Copy Seed</Text>
                  </TouchableOpacity>
                </View>
              )}

              <SettingItem
                icon="download-outline"
                title="Export Wallet"
                subtitle={showExportQR ? "Hide QR code" : "Backup your wallet"}
                onPress={handleExportWallet}
                rightElement={
                  <Ionicons 
                    name={showExportQR ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={theme.colors.textSecondary} 
                  />
                }
              />
              
              {/* Export QR Expandable Section */}
              {showExportQR && (
                <View style={[styles.expandableSection, { backgroundColor: theme.colors.background }]}>
                  <View style={[styles.qrContainer, { backgroundColor: 'white' }]}>
                    <QRCode
                      value={exportQRData}
                      size={qrSize}
                      backgroundColor="white"
                      color="black"
                    />
                  </View>
                  <Text style={[styles.qrDataText, { color: theme.colors.textSecondary }]}>
                    Scan this QR code to import the wallet
                  </Text>
                  <TouchableOpacity
                    style={[styles.copyButton, { backgroundColor: theme.colors.primaryLight }]}
                    onPress={handleCopyQRData}
                  >
                    <Ionicons name="copy-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.copyButtonText, { color: theme.colors.primary }]}>Copy QR Data</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Blockchain Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Blockchain</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <SettingItem
                icon="cloud-outline"
                title="Blockchain Sync"
                subtitle="Sync keys with Conceal Network"
                rightElement={
                  <Switch
                    value={blockchainSync}
                    onValueChange={handleBlockchainSyncToggle}
                    trackColor={{ 
                      false: theme.colors.border,
                      true: theme.colors.primary
                    }}
                    thumbColor={theme.colors.background}
                    ios_backgroundColor={theme.colors.border}
                  />
                }
              />
              <SettingItem
                icon="share-outline"
                title="Auto-Share Codes"
                subtitle="Automatically share codes via blockchain"
                rightElement={
                  <Switch
                    value={autoShare}
                    onValueChange={setAutoShare}
                    trackColor={{ 
                      false: theme.colors.border,
                      true: theme.colors.primary
                    }}
                    thumbColor={theme.colors.background}
                    ios_backgroundColor={theme.colors.border}
                  />
                }
              />
            </View>
          </View>

          {/* Security Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Security</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <SettingItem
                icon="finger-print-outline"
                title="Biometric Authentication"
                subtitle="Use fingerprint or face ID"
                rightElement={
                  <Switch
                    value={biometricAuth}
                    onValueChange={async (value) => {
                      if (!value) {
                        // User is disabling biometric auth - show warning
                        Alert.alert(
                          'Disable Biometric Authentication',
                          'You will be asked to set a new password for your wallet.\n\nYou will use this password to access the app instead of biometric authentication.',
                          [
                            {
                              text: 'Cancel',
                              onPress: () => {
                                // Don't change the toggle, keep it enabled
                                setBiometricAuth(true);
                              },
                              style: 'cancel'
                            },
                            {
                              text: 'Confirm',
                              onPress: async () => {
                                // Show password input alert for disabling biometric
                                setBiometricAction('disable');
                                setShowPasswordCreationAlert(true);
                              }
                            }
                          ]
                        );
                      } else {
                        // User is enabling biometric auth - request password to update biometric salt
                        Alert.alert(
                          'Enable Biometric Authentication',
                          'Enter your wallet password to enable biometric authentication.',
                          [
                            {
                              text: 'Cancel',
                              onPress: () => {
                                // Don't change the toggle, keep it disabled
                                setBiometricAuth(false);
                              },
                              style: 'cancel'
                            },
                            {
                              text: 'Enable',
                              onPress: async () => {
                                // Show password input alert
                                setBiometricAction('enable');
                                setShowUnlockWalletAlert(true);
                              }
                            }
                          ]
                        );
                      }
                    }}
                    trackColor={{ 
                      false: theme.colors.border,
                      true: theme.colors.primary
                    }}
                    thumbColor={theme.colors.background}
                    ios_backgroundColor={theme.colors.border}
                  />
                }
              />
              
              {/* Change Password option - only visible when biometric is disabled */}
              {!biometricAuth && (
                <SettingItem
                  icon="key-outline"
                  title="Change Password"
                  subtitle="Update your wallet password"
                  onPress={() => setShowPasswordChangeAlert(true)}
                />
              )}
            </View>
          </View>

          {/* Data Management */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <SettingItem
                icon="trash-outline"
                title="Clear All Data"
                subtitle="Remove all services and wallet data"
                onPress={handleClearData}
              />
            </View>
          </View>

          {/* About */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <SettingItem
                icon="information-circle-outline"
                title="Version"
                subtitle="1.0.0"
              />
              <SettingItem
                icon="help-circle-outline"
                title="Help & Support"
                onPress={() => Alert.alert('Help', 'Help documentation coming soon!')}
              />
            </View>
          </View>

        </ScrollView>
      </View>
      
      <PasswordChangeAlert
        visible={showPasswordChangeAlert}
        title="Change Password"
        message="Enter your current password and choose a new secure password."
        onCancel={() => setShowPasswordChangeAlert(false)}
        onConfirm={handlePasswordChange}
      />
      
      <UnlockWalletAlert
        visible={showUnlockWalletAlert}
        title="Enable Biometric Authentication"
        message="Enter your current wallet password to enable biometric authentication."
        onCancel={() => setShowUnlockWalletAlert(false)}
        onConfirm={handleEnableBiometric}
      />
      
      <PasswordCreationAlert
        visible={showPasswordCreationAlert}
        title="Set New Password"
        message="Enter a new password for your wallet. This will replace biometric authentication."
        onCancel={() => setShowPasswordCreationAlert(false)}
        onConfirm={handleDisableBiometric}
      />
    </GestureNavigator>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  expandableSection: {
    padding: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  expandableTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  seedText: {
    fontSize: 14,
    fontFamily: 'monospace',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    lineHeight: 20,
  },
  qrContainer: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrDataText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 12,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
}
)