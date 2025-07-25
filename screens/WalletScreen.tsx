import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';

import Header from '../components/Header';
import { useWallet } from '../contexts/WalletContext';
import { useTheme } from '../contexts/ThemeContext';

export default function WalletScreen() {
  const { wallet, balance, maxKeys, isLoading, refreshBalance } = useWallet();
  const { theme } = useTheme();
  const KEY_STORAGE_COST = 0.0001;

  const handleCopyAddress = async () => {
    if (wallet?.address) {
      try {
        await Clipboard.setStringAsync(wallet.address);
        Alert.alert('Copied', 'Wallet address copied to clipboard!');
      } catch (error) {
        Alert.alert('Error', 'Failed to copy address.');
      }
    }
  };

  const styles = createStyles(theme);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Header title="Wallet" />
        <View style={styles.loadingContainer}>
          <Ionicons name="wallet-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading wallet...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Wallet" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }]}>
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet-outline" size={24} color={theme.colors.primary} />
            <Text style={[styles.balanceLabel, { color: theme.colors.text }]}>CCX Balance</Text>
          </View>
          <Text style={[styles.balanceAmount, { color: theme.colors.primary }]}>
            {balance.toFixed(4)}
          </Text>
          <Text style={[styles.balanceUsd, { color: theme.colors.textSecondary }]}>
            Keys available: {maxKeys}
          </Text>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: theme.colors.primaryLight }]}
            onPress={refreshBalance}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.refreshText, { color: theme.colors.primary }]}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Key Storage Info */}
        {balance === 0 ? (
          <View style={[styles.welcomeCard, { backgroundColor: theme.colors.primaryLight }]}>
            <Ionicons name="wallet-outline" size={32} color={theme.colors.primary} />
            <Text style={[styles.welcomeTitle, { color: theme.colors.primary }]}>Welcome to SecureAuth!</Text>
            <Text style={[styles.welcomeText, { color: theme.colors.primary }]}>
              Your wallet has been created with 0 CCX. To sync your 2FA keys to the blockchain, 
              ask a friend to send you some CCX to your address below.
            </Text>
          </View>
        ) : (
          <View style={[styles.infoCard, { backgroundColor: theme.colors.primaryLight }]}>
            <Ionicons name="information-circle-outline" size={24} color={theme.colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: theme.colors.primary }]}>Blockchain Sync Available</Text>
              <Text style={[styles.infoText, { color: theme.colors.primary }]}>
                Each 2FA key sync costs {KEY_STORAGE_COST.toFixed(4)} CCX. 
                You can currently sync {maxKeys} keys to the blockchain.
              </Text>
            </View>
          </View>
        )}

        {/* Wallet Address Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="qr-code-outline" size={24} color={theme.colors.text} />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Receive CCX</Text>
          </View>
          
          <View style={[styles.qrContainer, { backgroundColor: theme.colors.background }]}>
            {wallet?.address && (
              <QRCode
                value={wallet.address}
                size={200}
                backgroundColor={theme.colors.surface}
                color={theme.colors.text}
              />
            )}
          </View>
          
          <View style={styles.addressContainer}>
            <Text style={[styles.addressLabel, { color: theme.colors.textSecondary }]}>Your Wallet Address:</Text>
            <Text style={[styles.addressText, { color: theme.colors.text, backgroundColor: theme.colors.background }]} numberOfLines={2}>
              {wallet?.address || 'Loading...'}
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.copyButton, { backgroundColor: theme.colors.primaryLight }]}
            onPress={handleCopyAddress}
            activeOpacity={0.8}
          >
            <Ionicons name="copy-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.copyButtonText, { color: theme.colors.primary }]}>Copy Address</Text>
          </TouchableOpacity>
        </View>

        {/* Funding Info Card */}
        {balance === 0 && (
          <View style={[styles.fundingCard, { backgroundColor: theme.colors.primaryLight }]}>
            <Ionicons name="people-outline" size={24} color={theme.colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: theme.colors.primary }]}>Get Started</Text>
              <Text style={[styles.infoText, { color: theme.colors.primary }]}>
                Share your wallet address with a friend or colleague to receive CCX. 
                Even a small amount (0.1 CCX) allows you to sync multiple keys!
              </Text>
            </View>
          </View>
        )}
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
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  balanceCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  balanceUsd: {
    fontSize: 14,
    marginBottom: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshText: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
  },
  addressContainer: {
    marginBottom: 16,
  },
  addressLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 12,
    fontFamily: 'monospace',
    padding: 12,
    borderRadius: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 12,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  welcomeCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    margin: 16,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  fundingCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
  },
});