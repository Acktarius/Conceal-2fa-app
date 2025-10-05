/**
*     Copyright (c) 2025, Acktarius 
*/
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';

import Header from '../components/Header';
import { useWallet } from '../contexts/WalletContext';
import { useTheme } from '../contexts/ThemeContext';
import GestureNavigator from '../components/GestureNavigator';
import { ExpandableSection } from '../components/ExpandableSection';
import QRScannerModal from '../components/QRScannerModal';
import { WalletService } from '../services/WalletService';
import { Wallet} from '../model/Wallet';
import { config } from '../config';
import { CoinUri } from '../model/CoinUri';
import { JSBigInt } from '../lib/biginteger';

export default function WalletScreen() {
  const { wallet, balance, maxKeys, isLoading, refreshBalance, refreshWallet, refreshCounter } = useWallet();
  const { theme } = useTheme();
  const KEY_STORAGE_COST = config.messageTxAmount.add(config.coinFee).add(config.remoteNodeFee);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [lastTap, setLastTap] = useState<number>(0);
  const [isReceiveExpanded, setIsReceiveExpanded] = useState<boolean>(false);
  const [isSendExpanded, setIsSendExpanded] = useState<boolean>(false);
  const [sendAddress, setSendAddress] = useState<string>('');
  const [sendAmount, setSendAmount] = useState<string>('');
  const [showQRScanner, setShowQRScanner] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const scrollViewRef = useRef<ScrollView>(null);


  // Handle keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // Auto-scroll to the amount input when keyboard shows
      if (isSendExpanded && scrollViewRef.current) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [isSendExpanded]);

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

  // Register balance refresh callback for automatic updates
  useEffect(() => {
    // Register this screen's refreshBalance function with WalletService
    WalletService.registerBalanceRefreshCallback(refreshBalance);
    
    // Cleanup: unregister when component unmounts
    return () => {
      WalletService.registerBalanceRefreshCallback(() => {}); // Clear callback
    };
  }, [refreshBalance]);

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

  const handleQRScan = (data: string) => {
    let parsed = false;
    try {
      const txDetails = CoinUri.decodeTx(data);
      if (txDetails !== null) {
        setSendAddress(txDetails.address);
        if (typeof txDetails.amount !== 'undefined') {
          setSendAmount(txDetails.amount);
        }
        parsed = true;
      }
    } catch (e) {
      // If CoinUri parsing fails, try basic validation
      if (data.startsWith('ccx') && data.length > 97) {
        setSendAddress(data);
        parsed = true;
      } else {
        setSendAddress(''); // Invalid address
      }
    }
    setShowQRScanner(false);
    setIsSendExpanded(true);
  };

  const handleQRScannerClose = () => {
    setShowQRScanner(false);
    // Expand send section for manual input when QR scanner is cancelled
    setIsSendExpanded(true);
  };

  const handleSendCCX = async () => {
    if (!sendAddress.trim() || !sendAmount.trim()) {
      Alert.alert('Error', 'Please enter both address and amount.');
      return;
    }

    // Validate recipient address
    if (!sendAddress.startsWith('ccx7') || sendAddress.length !== 98) {
      Alert.alert('Error', 'Invalid recipient address. Address must start with "ccx7" and be 98 characters long.');
      return;
    }

    const amount = parseFloat(sendAmount);
    const SEND_COST = config.coinFee.add(config.remoteNodeFee);
    const maxAmount = balance.subtract(SEND_COST);

    if (amount <= 0) {
      Alert.alert('Error', 'Amount must be greater than 0.');
      return;
    }

    if (amount > parseFloat(maxAmount.toHuman())) {
      Alert.alert('Error', 'Insufficient balance. Amount exceeds available balance minus fees.');
      return;
    }

    try {
      // Show processing alert but collapse Send CCX section immediately
      Alert.alert('Processing', 'Sending transaction...', [], {
        onDismiss: () => {
          // Collapse Send CCX section when alert is dismissed
          setSendAddress('');
          setSendAmount('');
          setIsSendExpanded(false);
        }
      });

      // Convert user input (CCX) to atomic units (smallest blockchain unit)
      // CCX has 6 decimal places, so 1 CCX = 1,000,000 atomic units
      const amountInAtoms = Math.floor(amount * Math.pow(10, config.coinUnitPlaces));
      /*
      console.log('WalletScreen: Converting user input to atomic units', {
        userInputHuman: amount.toFixed(6) + ' CCX',
        amountInAtoms: amountInAtoms,
        coinUnitPlaces: config.coinUnitPlaces
      });
      */
      // Send transaction using WalletService (amount parameter expects atomic units)
      const txHash = await WalletService.sendTransaction(
        sendAddress.trim(),
        amountInAtoms,
        '', // paymentId
        '' // message
      );

      // Success
      Alert.alert(
        'Transaction Sent', 
        `Successfully sent ${amount} CCX to ${sendAddress.substring(0, 10)}...\n\nTransaction Hash: ${txHash.substring(0, 16)}...`
      );
      
      // Reset form
      setSendAddress('');
      setSendAmount('');
      setIsSendExpanded(false);

      // Refresh wallet balance (don't resync entire wallet)
      await refreshBalance();

    } catch (error) {
      console.error('Send transaction error:', error);
      Alert.alert('Error', `Failed to send transaction: ${error.message}`);
    }
  };

  const handleCancelSend = () => {
    setSendAddress('');
    setSendAmount('');
    setIsSendExpanded(false);
  };

  const handleMaxAmount = () => {
    const SEND_COST = config.coinFee.add(config.remoteNodeFee);
    const maxAmount = balance.subtract(SEND_COST);
    setSendAmount(maxAmount.toHuman().toFixed(6));
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
        <ScrollView 
          ref={scrollViewRef}
          className="flex-1 px-4" 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: keyboardHeight + 20 }}
        >
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
                sectionTitle="Transfer"
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

              {/* Send CCX Section - Only show if wallet is synced */}
              {syncStatus?.isWalletSynced && (
                <ExpandableSection
                  sectionTitle=""
                  title="Send CCX"
                  subtitle="Scan QR code or enter address to send CCX"
                  icon="send-outline"
                  isExpanded={isSendExpanded}
                  onToggle={() => {
                    if (!isSendExpanded) {
                      setShowQRScanner(true);
                    } else {
                      setIsSendExpanded(false);
                    }
                  }}
                >
                  <View className="mb-4">
                    <Text 
                      className="text-sm mb-2 font-poppins-medium" 
                      style={{ color: theme.colors.text }}
                    >
                      Recipient Address:
                    </Text>
                    <TextInput
                      className="rounded-xl p-3 text-sm border font-mono"
                      style={{ 
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                      }}
                      value={sendAddress}
                      onChangeText={setSendAddress}
                      placeholder="CCX address to send to"
                      placeholderTextColor={theme.colors.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View className="mb-4">
                    <Text 
                      className="text-sm mb-2 font-poppins-medium" 
                      style={{ color: theme.colors.text }}
                    >
                      Amount (CCX):
                    </Text>
                    <View className="flex-row items-center">
                      <TouchableOpacity
                        className="w-10 h-10 rounded-lg items-center justify-center mr-2"
                        style={{ backgroundColor: theme.colors.primaryLight }}
                        onPress={() => {
                          const current = parseFloat(sendAmount || '0');
                          const newAmount = Math.max(0, current - 0.1);
                          setSendAmount(newAmount.toFixed(6));
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="remove" size={20} color={theme.colors.primary} />
                      </TouchableOpacity>
                      
                      <TextInput
                        className="flex-1 rounded-xl p-3 text-base border text-center font-mono"
                        style={{ 
                          backgroundColor: theme.colors.background,
                          color: theme.colors.text,
                          borderColor: theme.colors.border,
                        }}
                        value={sendAmount}
                        onChangeText={setSendAmount}
                        placeholder="0.000000"
                        placeholderTextColor={theme.colors.textSecondary}
                        keyboardType="numeric"
                        maxLength={10}
                      />
                      
                      <TouchableOpacity
                        className="w-10 h-10 rounded-lg items-center justify-center ml-2"
                        style={{ backgroundColor: theme.colors.primaryLight }}
                        onPress={() => {
                          const SEND_COST = config.coinFee.add(config.remoteNodeFee);
                          const maxAmount = balance.subtract(SEND_COST);
                          const current = parseFloat(sendAmount || '0');
                          const newAmount = Math.min(parseFloat(maxAmount.toHuman()), current + 0.1);
                          setSendAmount(newAmount.toFixed(6));
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={20} color={theme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity
                      className="mt-1"
                      onPress={handleMaxAmount}
                      activeOpacity={0.7}
                    >
                      <Text 
                        className="text-xs italic text-center font-poppins underline" 
                        style={{ color: theme.colors.primary }}
                      >
                        Max: {(balance.subtract(config.coinFee.add(config.remoteNodeFee))).toHuman().toFixed(6)} CCX
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      className="flex-1 rounded-xl p-3 items-center justify-center"
                      style={{ backgroundColor: theme.colors.border }}
                      onPress={handleCancelSend}
                      activeOpacity={0.8}
                    >
                      <Text 
                        className="text-base font-semibold font-poppins-medium" 
                        style={{ color: theme.colors.text }}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      className="flex-1 rounded-xl p-3 items-center justify-center"
                      style={{ backgroundColor: theme.colors.primary }}
                      onPress={handleSendCCX}
                      activeOpacity={0.8}
                    >
                      <Text className="text-base font-semibold text-white font-poppins-medium">
                        Send
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ExpandableSection>
              )}

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
      
      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={showQRScanner}
        onClose={handleQRScannerClose}
        onScan={handleQRScan}
      />
    </GestureNavigator>
  );
}

// Styles are now handled by Tailwind CSS classes