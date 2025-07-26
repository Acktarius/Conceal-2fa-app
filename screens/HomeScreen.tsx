import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import ServiceCard from '../components/ServiceCard';
import AddServiceModal from '../components/AddServiceModal';
import Header from '../components/Header';
import FundingBanner from '../components/FundingBanner';
import { TOTPService } from '../services/TOTPService';
import { StorageService } from '../services/StorageService';
import { BlockchainService } from '../services/BlockchainService';
import { SharedKey } from '../models/Transaction';
import { useWallet } from '../contexts/WalletContext';
import { useTheme } from '../contexts/ThemeContext';

export default function HomeScreen() {
  const [sharedKeys, setSharedKeys] = useState<SharedKey[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const { balance, maxKeys } = useWallet();
  const { theme } = useTheme();

  useEffect(() => {
    loadSharedKeys();
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
      updateCodes();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadSharedKeys = async () => {
    try {
      const savedSharedKeys = await StorageService.getSharedKeys();
      setSharedKeys(savedSharedKeys.map(sharedKey => ({
        ...sharedKey,
        code: TOTPService.generateTOTP(sharedKey.secret),
        timeRemaining: TOTPService.getTimeRemaining(),
      })));
    } catch (error) {
      console.error('Error loading shared keys:', error);
    }
  };

  const updateCodes = () => {
    setSharedKeys(prevSharedKeys => 
      prevSharedKeys.map(sharedKey => ({
        ...sharedKey,
        code: TOTPService.generateTOTP(sharedKey.secret),
        timeRemaining: TOTPService.getTimeRemaining(),
      }))
    );
  };

  const handleAddService = async (serviceData: { name: string; issuer: string; secret: string }) => {
    try {
      const newSharedKey = SharedKey.fromService(serviceData);
      newSharedKey.code = TOTPService.generateTOTP(serviceData.secret);
      newSharedKey.timeRemaining = TOTPService.getTimeRemaining();

      const updatedSharedKeys = [...sharedKeys, newSharedKey];
      setSharedKeys(updatedSharedKeys);
      
      await StorageService.saveSharedKeys(updatedSharedKeys);
      setShowAddModal(false);
      
      Alert.alert('Success', 'Service added locally! Sync to blockchain when you have CCX balance.');
    } catch (error) {
      Alert.alert('Error', 'Failed to add service. Please try again.');
    }
  };

  const handleBroadcastToMyself = async (sharedKeyHash: string) => {
    const sharedKey = sharedKeys.find(sk => sk.hash === sharedKeyHash || sk.name + '_' + sk.timeStampSharedKeyCreate === sharedKeyHash);
    if (!sharedKey) return;

    try {
      // Simulate broadcasting to blockchain mempool with 30s TTL
      Alert.alert(
        'Code Broadcasted',
        `${sharedKey.name} code (${sharedKey.code}) broadcasted to blockchain mempool for 30 seconds. Your other devices can now access it.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to broadcast code.');
    }
  };

  const handleSaveToBlockchain = async (sharedKeyId: string) => {
    const sharedKey = sharedKeys.find(sk => sk.hash === sharedKeyId || sk.name + '_' + sk.timeStampSharedKeyCreate === sharedKeyId);
    if (!sharedKey) return;

    try {
      // Create blockchain transaction
      const txHash = await BlockchainService.createSharedKeyTransaction(sharedKey);
      
      const updatedSharedKeys = sharedKeys.map(sk => 
        sk === sharedKey ? sharedKey : sk
      );
      
      setSharedKeys(updatedSharedKeys);
      await StorageService.saveSharedKeys(updatedSharedKeys);
      
      Alert.alert('Success', `${sharedKey.name} key saved to blockchain successfully!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save key to blockchain.');
    }
  };

  const handleCopyCode = async (code: string, sharedKeyName: string) => {
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert('Copied', `${sharedKeyName} code copied to clipboard!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy code to clipboard.');
    }
  };

  const handleDeleteSharedKey = async (sharedKeyId: string) => {
    const sharedKey = sharedKeys.find(sk => sk.hash === sharedKeyId || sk.name + '_' + sk.timeStampSharedKeyCreate === sharedKeyId);
    if (!sharedKey) return;

    try {
      let updatedSharedKeys;
      
      if (sharedKey.isLocalOnly) {
        // Simply delete local-only SharedKeys (transaction objects)
        updatedSharedKeys = sharedKeys.filter(sk => sk !== sharedKey);
        
        Alert.alert('Deleted', `${sharedKey.name} has been removed.`);
      } else {
        // SharedKey was saved on blockchain, need to handle revocation
        const minTransactionAmount = 0.011;
        const isWalletSynced = true; // Mock - replace with actual wallet sync status
        
        if (isWalletSynced && balance >= minTransactionAmount) {
          try {
            // Submit revoke transaction to blockchain
            const revokeTxHash = await BlockchainService.revokeSharedKeyTransaction(sharedKey);
            console.log('Revoke transaction submitted:', revokeTxHash);
            
            // Remove the SharedKey after successful revocation
            updatedSharedKeys = sharedKeys.filter(sk => sk !== sharedKey);
            
            Alert.alert(
              'SharedKey Revoked', 
              `${sharedKey.name} has been removed and revoked on the blockchain.`
            );
          } catch (error) {
            // If revoke transaction fails, mark as inQueue
            sharedKey.revokeInQueue = true;
            updatedSharedKeys = sharedKeys.map(sk => 
              sk === sharedKey ? sharedKey : sk
            );
            
            Alert.alert(
              'Revoke Queued', 
              `${sharedKey.name} removal queued. Will be revoked when wallet syncs with sufficient balance.`
            );
          }
        } else {
          // Insufficient balance or not synced, mark as inQueue
          sharedKey.revokeInQueue = true;
          updatedSharedKeys = sharedKeys.map(sk => 
            sk === sharedKey ? sharedKey : sk
          );
          
          Alert.alert(
            'Revoke Queued', 
            `${sharedKey.name} removal queued. Will be revoked when wallet syncs with sufficient balance (0.011 CCX required).`
          );
        }
      }
      
      setSharedKeys(updatedSharedKeys);
      await StorageService.saveSharedKeys(updatedSharedKeys);
      
      const selectedId = sharedKey.hash || sharedKey.name + '_' + sharedKey.timeStampSharedKeyCreate;
      if (selectedServiceId === selectedId) {
        setSelectedServiceId(null);
      }
    } catch (error) {
      console.error('Error deleting SharedKey:', error);
      Alert.alert('Error', 'Failed to delete SharedKey.');
    }
  };

  const handleSelectSharedKey = (sharedKeyId: string) => {
    setSelectedServiceId(selectedServiceId === sharedKeyId ? null : sharedKeyId);
  };

  // Mock wallet sync status - in real app this would come from wallet context
  const isWalletSynced = true;

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Header title="Authenticator" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <FundingBanner 
          balance={balance}
          maxKeys={maxKeys}
          onPress={() => {/* Navigate to wallet tab or show funding info */}}
        />

        {sharedKeys.filter(sk => !sk.revokeInQueue).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Services Added</Text>
            <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
              Add your first 2FA service by tapping the + button below. Keys are stored locally first.
            </Text>
          </View>
        ) : (
          <View style={styles.servicesList}>
            {sharedKeys.filter(sk => !sk.revokeInQueue).map((sharedKey) => {
              const sharedKeyId = sharedKey.hash || sharedKey.name + '_' + sharedKey.timeStampSharedKeyCreate;
              return (
              <ServiceCard
                key={sharedKeyId}
                sharedKey={sharedKey}
                isSelected={selectedServiceId === sharedKeyId}
                walletBalance={balance}
                isWalletSynced={isWalletSynced}
                onCopy={() => handleCopyCode(sharedKey.code, sharedKey.name)}
                onDelete={() => handleDeleteSharedKey(sharedKeyId)}
                onSelect={() => handleSelectSharedKey(sharedKeyId)}
                onBroadcast={() => handleBroadcastToMyself(sharedKeyId)}
                onSaveToBlockchain={() => handleSaveToBlockchain(sharedKeyId)}
              />
              );
            })}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <AddServiceModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddService}
      />
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 32,
  },
  servicesList: {
    paddingVertical: 16,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    ...(Platform.OS === 'web' && {
      transition: 'all 0.2s ease-in-out',
    }),
    ...(Platform.OS === 'web' && theme.isDark && {
      ':hover': {
        boxShadow: '0 0 20px rgba(255, 165, 0, 0.6), 0 0 40px rgba(255, 165, 0, 0.4)',
        transform: 'scale(1.05)',
      },
    }),
  },
});