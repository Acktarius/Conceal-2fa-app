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
      const sharedKeysWithCodes = await Promise.all(savedSharedKeys.map(async sharedKey => {
        // Preserve the SharedKey instance and update properties directly
        sharedKey.code = await TOTPService.generateTOTP(sharedKey.secret);
        sharedKey.timeRemaining = TOTPService.getTimeRemaining();
        return sharedKey;
      }));
      setSharedKeys(sharedKeysWithCodes);
    } catch (error) {
      console.error('Error loading shared keys:', error);
    }
  };

  const updateCodes = async () => {
    const updatedSharedKeys = await Promise.all(
      sharedKeys.map(async sharedKey => {
        // Create new SharedKey instance to preserve class methods
        const newSharedKey = new SharedKey();
        // Copy all properties from the previous SharedKey
        Object.assign(newSharedKey, sharedKey);
        // Update the code and time remaining
        newSharedKey.code = await TOTPService.generateTOTP(sharedKey.secret);
        newSharedKey.timeRemaining = TOTPService.getTimeRemaining();
        return newSharedKey;
      })
    );
    setSharedKeys(updatedSharedKeys);
  };

  const handleAddService = async (serviceData: { name: string; issuer: string; secret: string }) => {
    try {
      const newSharedKey = SharedKey.fromService(serviceData);
      newSharedKey.code = await TOTPService.generateTOTP(serviceData.secret);
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
    const sharedKey = sharedKeys.find(sk => {
      const localId = sk.name + '_' + sk.timeStampSharedKeyCreate;
      return sk.hash === sharedKeyId || localId === sharedKeyId;
    });
    if (!sharedKey) return;

    try {
      if (sharedKey.isLocalOnly()) {
        // Simply delete local-only SharedKeys
        const updatedSharedKeys = sharedKeys.filter(sk => sk !== sharedKey);
        setSharedKeys(updatedSharedKeys);
        await StorageService.saveSharedKeys(updatedSharedKeys);
      } else {
        // SharedKey is on blockchain, set revokeInQueue and hide from screen
        sharedKey.revokeInQueue = true;
        const updatedSharedKeys = sharedKeys.map(sk => 
          sk === sharedKey ? sharedKey : sk
        );
        
        setSharedKeys(updatedSharedKeys);
        await StorageService.saveSharedKeys(updatedSharedKeys);
      }
      
      // Clear selection if deleted item was selected
      const selectedId = sharedKey.hash || sharedKey.name + '_' + sharedKey.timeStampSharedKeyCreate;
      if (selectedServiceId === selectedId) {
        setSelectedServiceId(null);
      }
    } catch (error) {
      console.error('Error deleting SharedKey:', error);
    }
  };

  const handleSelectSharedKey = (sharedKeyId: string) => {
    setSelectedServiceId(selectedServiceId === sharedKeyId ? null : sharedKeyId);
  };

  const shouldDisplaySharedKey = (sharedKey: SharedKey): boolean => {
    // 1. isLocal() (hash === '') and revokeInQueue = false -> Display
    if (sharedKey.isLocalOnly() && !sharedKey.revokeInQueue) {
      return true;
    }
    
    // 2. !isLocal() and revokeInQueue = true -> Hidden
    if (!sharedKey.isLocalOnly() && sharedKey.revokeInQueue) {
      return false;
    }
    
    // 4. extraStatus = ff02 (revoke transactions) -> Never display
    if (!sharedKey.isLocalOnly() && sharedKey.extraStatus === 'ff02') {
      return false;
    }
    
    // 4. Check if there's a revoke transaction (ff02) that matches this key's extraSharedKey
    const hasMatchingRevokeTransaction = sharedKeys.some(sk => 
      sk.extraStatus === 'ff02' && 
      sk.extraSharedKey === sharedKey.extraSharedKey &&
      sk.extraSharedKey !== ''
    );
    
    if (hasMatchingRevokeTransaction) {
      return false;
    }
    
    // 3. !isLocal() and revokeInQueue = false -> Display (if not revoked)
    if (!sharedKey.isLocalOnly() && !sharedKey.revokeInQueue) {
      return true;
    }
    
    // Default: don't display
    return false;
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

        {sharedKeys.filter(shouldDisplaySharedKey).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Services Added</Text>
            <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
              Add your first 2FA service by tapping the + button below. Keys are stored locally first.
            </Text>
          </View>
        ) : (
          <View style={styles.servicesList}>
            {sharedKeys.filter(shouldDisplaySharedKey).map((sharedKey) => {
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