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
import GestureNavigator from '../components/GestureNavigator';
import { WalletService } from '../services/WalletService';
import { Wallet} from '../model/Wallet';

export default function WalletScreen() {
  const { wallet, balance, maxKeys, isLoading, refreshBalance, refreshWallet, refreshCounter } = useWallet();
  const { theme } = useTheme();
  const KEY_STORAGE_COST = 0.0001;
  const [syncStatus, setSyncStatus] = useState<any>(null);


  // Update sync status periodically for blockchain wallets
  useEffect(() => {
    if (wallet && !wallet.isLocal()) {
      const updateSyncStatus = () => {
        const status = WalletService.getWalletSyncStatus();
        setSyncStatus(status);
      };
      
      // Update immediately
      updateSyncStatus();
      
      // Update every 5 seconds
      const interval = setInterval(updateSyncStatus, 5000);
      
      return () => clearInterval(interval);
    } else {
      setSyncStatus(null);
    }
  }, [wallet, refreshCounter]);

  // Check wallet and show upgrade prompt if needed
  useEffect(() => {
    const checkWallet = async () => {
      console.log('WALLET SCREEN: Checking wallet...');
      console.log('WALLET SCREEN: wallet exists:', !!wallet);
      console.log('WALLET SCREEN: wallet isLocal:', wallet?.isLocal());
      
      if (wallet && wallet.isLocal()) {
        console.log('WALLET SCREEN: Calling getOrCreateWallet("wallet")...');
        try {
          // Show upgrade prompt for local wallet
          const result = await WalletService.getOrCreateWallet('wallet');
          console.log('WALLET SCREEN: getOrCreateWallet result:', !!result);
          
          // Check if wallet was actually upgraded (no longer local)
          if (result && !result.isLocal()) {
            // Wallet was upgraded, refresh the context
            console.log('Wallet upgraded successfully - triggering refresh');
            // Trigger a wallet refresh to show the updated state
            await refreshWallet(result);
          } else if (result && result.isLocal()) {
            console.log('Wallet remains local - no refresh needed');
          }
        } catch (error) {
          console.error('Error checking wallet:', error);
        }
      }
    };

    checkWallet();
  }, [wallet, refreshCounter]);


  const handleUpgradeWallet = async () => {
    try {
      const result = await WalletService.triggerWalletUpgrade();
      if (result && !result.isLocal()) {
        // Wallet was upgraded, refresh the context
        console.log('WALLET SCREEN: Wallet upgraded successfully - triggering refresh');
        // Trigger a wallet refresh to show the updated state
        await refreshWallet(result);
      } else if (result && result.isLocal()) {
        console.log('WALLET SCREEN: Wallet remains local - no refresh needed');
      } else {
        console.log('WALLET SCREEN: Upgrade cancelled by user');
      }
    } catch (error) {
      console.error('Error upgrading wallet:', error);
    }
  };


  // Check if wallet is local-only using the existing method
  const isLocalWallet = wallet && wallet.isLocal();

  const handleCopyAddress = async () => {
    if (wallet?.getPublicAddress()) {
      try {
        await Clipboard.setStringAsync(wallet.getPublicAddress());
        Alert.alert('Copied', 'Wallet address copied to clipboard!');
      } catch (error) {
        Alert.alert('Error', 'Failed to copy address.');
      }
    }
  };

  const styles = createStyles(theme);

  if (isLoading) {
    return (
      <GestureNavigator>
        <View style={[styles.container, styles.centered]}>
          <Header title="Wallet" />
          <View style={styles.loadingContainer}>
            <Ionicons name="wallet-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading wallet...</Text>
          </View>
        </View>
      </GestureNavigator>
    );
  }

  return (
    <GestureNavigator>
      <View style={styles.container}>
        <Header title="Wallet" />
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {isLocalWallet ? (
            // Local Wallet Mode
            <View style={[styles.localWalletCard, { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }]}>
              <View style={styles.localWalletHeader}>
                <Ionicons name="wallet-outline" size={32} color={theme.colors.textSecondary} />
                <Text style={[styles.localWalletTitle, { color: theme.colors.text }]}>Local Wallet Mode</Text>
              </View>
              <Text style={[styles.localWalletText, { color: theme.colors.textSecondary }]}>
                Your wallet is currently in local-only mode. Upgrade to blockchain mode to sync your 2FA keys and access full features.
              </Text>
              <TouchableOpacity
                style={[styles.upgradeButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleUpgradeWallet}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-up-outline" size={20} color="white" />
                <Text style={styles.upgradeButtonText}>Upgrade to Blockchain Wallet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Normal Wallet Mode
            <>
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

              {/* Synchronization Status */}
              {syncStatus && (
                <View style={[styles.syncCard, { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }]}>
                  <View style={styles.syncHeader}>
                    <Ionicons 
                      name={syncStatus.isRunning ? "sync-outline" : "checkmark-circle-outline"} 
                      size={24} 
                      color={syncStatus.isWalletSynced ? theme.colors.success : theme.colors.warning} 
                    />
                    <Text style={[styles.syncTitle, { color: theme.colors.text }]}>
                      {syncStatus.isWalletSynced ? 'Wallet Synced' : 'Synchronizing...'}
                    </Text>
                  </View>
                  
                  {syncStatus.isRunning && (
                    <View style={styles.syncDetails}>
                      <Text style={[styles.syncText, { color: theme.colors.textSecondary }]}>
                        Block: {syncStatus.lastBlockLoading} / {syncStatus.lastMaximumHeight}
                      </Text>
                      {syncStatus.transactionsInQueue > 0 && (
                        <Text style={[styles.syncText, { color: theme.colors.textSecondary }]}>
                          Processing: {syncStatus.transactionsInQueue} transactions
                        </Text>
                      )}
                    </View>
                  )}
                  
                  {syncStatus.isWalletSynced && (
                    <Text style={[styles.syncText, { color: theme.colors.success }]}>
                      ✓ Wallet is up to date with blockchain
                    </Text>
                  )}
                </View>
              )}

              {/* Key Storage Info */}
              {balance === 0 && wallet?.getPublicAddress() ? (
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
                
                <View style={[styles.qrContainer, { backgroundColor: 'white' }]}>
                  {wallet?.getPublicAddress() && (
                    <QRCode
                      value={wallet.getPublicAddress()}
                      size={250}
                      backgroundColor="white"
                      color="black"
                    />
                  )}
                </View>
                
                <View style={styles.addressContainer}>
                  <Text style={[styles.addressLabel, { color: theme.colors.textSecondary }]}>Your Wallet Address:</Text>
                  <Text style={[styles.addressText, { color: theme.colors.text, backgroundColor: theme.colors.background }]} numberOfLines={2}>
                    {wallet?.getPublicAddress() || 'Loading...'}
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
            </>
          )}
        </ScrollView>
      </View>
    </GestureNavigator>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  syncCard: {
    borderRadius: 16,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  syncTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  syncDetails: {
    marginTop: 8,
  },
  syncText: {
    fontSize: 14,
    marginBottom: 4,
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
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  localWalletCard: {
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
  localWalletHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  localWalletTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
  },
  localWalletText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
});