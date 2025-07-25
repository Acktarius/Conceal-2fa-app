import React, { useState } from 'react';
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

import Header from '../../components/Header';
import { useTheme } from '../../contexts/ThemeContext';
import { useWallet } from '../../contexts/WalletContext';

export default function SettingsScreen() {
  const [blockchainSync, setBlockchainSync] = useState(true);
  const [autoShare, setAutoShare] = useState(false);
  const [biometricAuth, setBiometricAuth] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();
  const { wallet } = useWallet();

  const styles = createStyles(theme);

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
    <View style={styles.container}>
      <Header title="Settings" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
                  trackColor={{ false: theme.colors.switchTrackFalse, true: theme.colors.switchTrackTrue }}
                  thumbColor={theme.colors.background}
                  ios_backgroundColor={theme.colors.switchTrackFalse}
                />
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Wallet Management</Text>
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <SettingItem
              icon="key-outline"
              title="Show Recovery Seed"
              subtitle="View your 25-word recovery phrase"
              onPress={handleShowSeed}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
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
});