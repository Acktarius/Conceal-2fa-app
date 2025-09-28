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
import { ExpandableSection } from '../components/ExpandableSection';
import { WalletService } from '../services/WalletService';
import { Wallet} from '../model/Wallet';
import { config } from '../config';

export default function WalletScreen() {
  const { wallet, balance, maxKeys, isLoading, refreshBalance, refreshWallet, refreshCounter } = useWallet();
  const { theme } = useTheme();
  const KEY_STORAGE_COST = config.messageTxAmount.add(config.coinFee).add(config.remoteNodeFee);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [lastTap, setLastTap] = useState<number>(0);
  const [isReceiveExpanded, setIsReceiveExpanded] = useState<boolean>(false);


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

  const handleSyncCardDoubleTap = async () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // 300ms between taps
    
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected - trigger manual save
      try {
        console.log('WALLET SCREEN: Double tap detected - triggering manual save');
        await WalletService.triggerManualSave();
        Alert.alert('Success', 'Wallet saved successfully!');
      } catch (error) {
        console.error('WALLET SCREEN: Error during manual save:', error);
        Alert.alert('Error', 'Failed to save wallet. Please try again.');
      }
    } else {
      setLastTap(now);
    }
  };

  // Styles are now handled by Tailwind CSS classes

  if (isLoading) {
    return (
      <GestureNavigator>
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: theme.colors.background }}>
          <Header title="Wallet" />
          <View className="flex-1 items-center justify-center">
            <Ionicons name="wallet-outline" size={48} color={theme.colors.textSecondary} />
            <Text className="text-base mt-3" style={{ color: theme.colors.textSecondary }}>Loading wallet...</Text>
          </View>
        </View>
      </GestureNavigator>
    );
  }

  return (
    <GestureNavigator>
      <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
        <Header title="Wallet" />
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {isLocalWallet ? (
            // Local Wallet Mode
            <View className="rounded-2xl p-6 items-center m-4 shadow-lg border" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
              <View className="items-center mb-4">
                <Ionicons name="wallet-outline" size={32} color={theme.colors.textSecondary} />
                <Text className="text-xl font-semibold mt-2" style={{ color: theme.colors.text }}>Local Wallet Mode</Text>
              </View>
              <Text className="text-sm text-center leading-5 mb-6" style={{ color: theme.colors.textSecondary }}>
                Your wallet is currently in local-only mode. Upgrade to blockchain mode to sync your 2FA keys and access full features.
              </Text>
              <TouchableOpacity
                className="flex-row items-center justify-center rounded-xl px-5 py-3"
                style={{ backgroundColor: theme.colors.primary }}
                onPress={handleUpgradeWallet}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-up-outline" size={20} color="white" />
                <Text className="text-base font-semibold text-white ml-2">Upgrade to Blockchain Wallet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Normal Wallet Mode
            <>
              {/* Balance Card */}
              <View className="rounded-2xl p-6 items-center m-4 shadow-lg border" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                <View className="flex-row items-center mb-3">
                  <Ionicons name="wallet-outline" size={24} color={theme.colors.primary} />
                  <Text className="text-base ml-2 font-medium" style={{ color: theme.colors.text }}>CCX Balance</Text>
                </View>
                <Text className="text-3xl font-bold mb-1" style={{ color: theme.colors.primary }}>
                  {balance.toHuman().toFixed(4)}
                </Text>
                <Text className="text-sm mb-3" style={{ color: theme.colors.textSecondary }}>
                  Keys available: {maxKeys.toString()}
                </Text>
                <TouchableOpacity
                  className="flex-row items-center rounded-lg px-3 py-1.5"
                  style={{ backgroundColor: theme.colors.primaryLight }}
                  onPress={refreshBalance}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
                  <Text className="text-sm font-medium ml-1" style={{ color: theme.colors.primary }}>Refresh</Text>
                </TouchableOpacity>
              </View>

              {/* Synchronization Status */}
              {syncStatus && (
                <TouchableOpacity 
                  className="rounded-2xl p-4 m-4 shadow-lg border"
                  style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
                  onPress={handleSyncCardDoubleTap}
                  activeOpacity={0.8}
                >
                  <View className="flex-row items-center mb-2">
                    <Ionicons 
                      name={syncStatus.isRunning ? "sync-outline" : "checkmark-circle-outline"} 
                      size={24} 
                      color={syncStatus.isWalletSynced ? theme.colors.success : theme.colors.warning} 
                    />
                    <Text className="text-base font-semibold ml-2" style={{ color: theme.colors.text }}>
                      {syncStatus.isWalletSynced ? 'Wallet Synced' : 'Synchronizing...'}
                    </Text>
                  </View>
                  
                  {syncStatus.isRunning && (
                    <View className="mt-2">
                      <Text className="text-sm mb-1" style={{ color: theme.colors.textSecondary }}>
                        Block: {syncStatus.lastBlockLoading} / {syncStatus.lastMaximumHeight}
                      </Text>
                      {syncStatus.transactionsInQueue > 0 && (
                        <Text className="text-sm" style={{ color: theme.colors.textSecondary }}>
                          Processing: {syncStatus.transactionsInQueue} transactions
                        </Text>
                      )}
                    </View>
                  )}
                  
                  {syncStatus.isWalletSynced && (
                    <View>
                      <Text className="text-sm" style={{ color: theme.colors.success }}>
                        ✓ Wallet is up to date with blockchain
                      </Text>
                      <Text className="text-xs italic mt-1" style={{ color: theme.colors.textSecondary }}>
                        Double tap to save manually
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* Key Storage Info */}
              {balance.compare(new JSBigInt(0)) === 0 && wallet?.getPublicAddress() ? (
                <View className="rounded-2xl p-5 items-center m-4" style={{ backgroundColor: theme.colors.primaryLight }}>
                  <Ionicons name="wallet-outline" size={32} color={theme.colors.primary} />
                  <Text className="text-lg font-semibold mt-3 mb-2" style={{ color: theme.colors.primary }}>Welcome to SecureAuth!</Text>
                  <Text className="text-sm text-center leading-5" style={{ color: theme.colors.primary }}>
                    Your wallet has been created with 0 CCX. To sync your 2FA keys to the blockchain, 
                    ask a friend to send you some CCX to your address below.
                  </Text>
                </View>
              ) : (
                <View className="rounded-2xl p-4 flex-row items-start m-4" style={{ backgroundColor: theme.colors.primaryLight }}>
                  <Ionicons name="information-circle-outline" size={24} color={theme.colors.primary} />
                  <View className="flex-1 ml-3">
                    <Text className="text-base font-semibold mb-1" style={{ color: theme.colors.primary }}>Blockchain Sync Available</Text>
                    <Text className="text-sm leading-5" style={{ color: theme.colors.primary }}>
                      Each 2FA key sync costs {KEY_STORAGE_COST.toHuman().toFixed(4)} CCX. 
                      You can currently sync {maxKeys.toString()} keys to the blockchain.
                    </Text>
                  </View>
                </View>
              )}

              {/* Wallet Address Card */}
              <ExpandableSection
                title="Receive CCX"
                subtitle="Reveal QR code or copy wallet address"
                icon="qr-code-outline"
                isExpanded={isReceiveExpanded}
                onToggle={() => setIsReceiveExpanded(!isReceiveExpanded)}
              >
                <View className="items-center mb-5 p-5 rounded-xl shadow-md" style={{ backgroundColor: 'white' }}>
                  {wallet?.getPublicAddress() && (
                    <QRCode
                      value={wallet.getPublicAddress()}
                      size={250}
                      backgroundColor="white"
                      color="black"
                    />
                  )}
                </View>
                
                <View className="mb-4">
                  <Text 
                    className="text-sm mb-2 font-poppins" 
                    style={{ color: theme.colors.textSecondary }}
                  >
                    Your Wallet Address:
                  </Text>
                  <Text 
                    className="text-xs font-mono p-3 rounded-lg font-poppins" 
                    style={{ color: theme.colors.text, backgroundColor: theme.colors.background }} 
                    numberOfLines={2}
                  >
                    {wallet?.getPublicAddress() || 'Loading...'}
                  </Text>
                </View>
                
                <TouchableOpacity
                  className="flex-row items-center justify-center rounded-xl p-3"
                  style={{ backgroundColor: theme.colors.primaryLight }}
                  onPress={handleCopyAddress}
                  activeOpacity={0.8}
                >
                  <Ionicons name="copy-outline" size={20} color={theme.colors.primary} />
                  <Text 
                    className="text-base font-semibold ml-2 font-poppins-medium" 
                    style={{ color: theme.colors.primary }}
                  >
                    Copy Address
                  </Text>
                </TouchableOpacity>
              </ExpandableSection>

              {/* Funding Info Card */}
              {balance.compare(new JSBigInt(0)) === 0 && (
                <View className="rounded-2xl p-4 flex-row items-start m-4" style={{ backgroundColor: theme.colors.primaryLight }}>
                  <Ionicons name="people-outline" size={24} color={theme.colors.primary} />
                  <View className="flex-1 ml-3">
                    <Text className="text-base font-semibold mb-1" style={{ color: theme.colors.primary }}>Get Started</Text>
                    <Text className="text-sm leading-5" style={{ color: theme.colors.primary }}>
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

// Styles are now handled by Tailwind CSS classes