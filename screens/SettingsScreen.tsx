import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import Header from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import { useWallet } from '../contexts/WalletContext';
import GestureNavigator from '../components/GestureNavigator';
import { StorageService } from '../services/StorageService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlockchainSyncWorker } from '../services/BlockchainSyncWorker';
import { WalletService } from '../services/WalletService';

type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const [blockchainSync, setBlockchainSync] = useState(false);
  const [autoShare, setAutoShare] = useState(false);
  const [biometricAuth, setBiometricAuth] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();
  const { wallet, resetWallet } = useWallet();
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
    if (wallet?.seed) {
      Alert.alert(
        'Recovery Seed',
        `Your 25-word recovery seed:\n\n${wallet.seed}`,
        [
          {
            text: 'Copy',
            onPress: async () => {
              try {
                await Clipboard.setStringAsync(wallet.seed);
                Alert.alert('Copied', 'Recovery seed copied to clipboard!');
              } catch (error) {
                Alert.alert('Error', 'Failed to copy seed.');
              }
            },
          },
          { text: 'Close', style: 'cancel' },
        ]
      );
    }
  };

  const handleExportWallet = () => {
    Alert.alert(
      'Export Wallet',
      'Choose export method:',
      [
        {
          text: 'QR Code',
          onPress: () => Alert.alert('QR Code', 'QR code export feature coming soon!'),
        },
        {
          text: '25-Word Seed',
          onPress: () => Alert.alert('Seed Phrase', 'Seed phrase export available in Wallet tab'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
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
              
              await WalletService.resetWallet();
              
              // Also reset the wallet context
              resetWallet();
              
              console.log('=== AFTER CLEAR ===');
              await StorageService.debugStorage();
              
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
                subtitle="View your 25-word recovery phrase"
                onPress={handleShowSeed}
              />
              <SettingItem
                icon="download-outline"
                title="Export Wallet"
                subtitle="Backup your wallet"
                onPress={handleExportWallet}
              />
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
                      setBiometricAuth(value);
                      await StorageService.saveSettings({
                        ...await StorageService.getSettings(),
                        biometricAuth: value
                      });
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
}
)