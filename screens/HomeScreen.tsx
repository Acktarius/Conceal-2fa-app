/**
*     Copyright (c) 2025, Acktarius 
*/
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
import { WalletService } from '../services/WalletService';
import { CronBuddy } from '../services/CronBuddy';
import { SharedKey } from '../model/Transaction';
import { useWallet } from '../contexts/WalletContext';
import { useTheme } from '../contexts/ThemeContext';
import GestureNavigator from '../components/GestureNavigator';

export default function HomeScreen() {
  const [sharedKeys, setSharedKeys] = useState<SharedKey[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [blockchainSyncEnabled, setBlockchainSyncEnabled] = useState(false);
  const { balance, maxKeys, isAuthenticated, authenticate, wallet } = useWallet();
  const { theme } = useTheme();
  const serviceCardRefs = React.useRef<{ [key: string]: any }>({});

  useEffect(() => {
    loadSharedKeys();
    loadBlockchainSyncSetting();
    
    // Register shared keys refresh callback
    WalletService.registerSharedKeysRefreshCallback(loadSharedKeys);
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
      updateCodes();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadSharedKeys = async () => {
    try {
      const savedSharedKeys = await StorageService.getSharedKeys();
      const sharedKeysWithCodes = await Promise.all(savedSharedKeys.map(async savedKey => {
        // Create proper SharedKey instance
        const sharedKey = new SharedKey();
        Object.assign(sharedKey, savedKey);
        sharedKey.code = await TOTPService.generateTOTP(sharedKey.secret);
        sharedKey.timeRemaining = TOTPService.getTimeRemaining();
        return sharedKey;
      }));
      setSharedKeys(sharedKeysWithCodes);
    } catch (error) {
      console.error('Error loading shared keys:', error);
    }
  };

  const loadBlockchainSyncSetting = async () => {
    try {
      const settings = await StorageService.getSettings();
      const syncEnabled = settings.blockchainSync || false;
      setBlockchainSyncEnabled(syncEnabled);
      console.log('HomeScreen: Loaded blockchain sync setting:', syncEnabled);
    } catch (error) {
      console.error('Error loading blockchain sync setting:', error);
    }
  };

  const updateCodes = async () => {
    setSharedKeys(prevSharedKeys => {
      Promise.all(prevSharedKeys.map(async sharedKey => {
        const updatedCode = await TOTPService.generateTOTP(sharedKey.secret);
        const updatedTimeRemaining = TOTPService.getTimeRemaining();
        
        // Create new SharedKey instance with all properties preserved
        const updatedSharedKey = new SharedKey();
        Object.assign(updatedSharedKey, sharedKey, {
          code: updatedCode,
          timeRemaining: updatedTimeRemaining
        });
        
        return updatedSharedKey;
      })).then(updatedSharedKeys => {
        setSharedKeys(updatedSharedKeys);
      });
      
      return prevSharedKeys;
    });
  };

  const handleAddService = async (serviceData: any) => {
    try {
     console.log('Adding service with data:', serviceData);
     
      const newSharedKey = SharedKey.fromRaw({
        name: serviceData.name,
        issuer: serviceData.issuer,
        secret: serviceData.secret
      });
      
     console.log('Created SharedKey:', {
       name: newSharedKey.name,
       issuer: newSharedKey.issuer,
       secret: newSharedKey.secret ? 'present' : 'missing'
     });
     
      newSharedKey.code = await TOTPService.generateTOTP(serviceData.secret);
      newSharedKey.timeRemaining = TOTPService.getTimeRemaining();
      
      // Set toBePush based on wallet type and blockchain sync setting
      if (wallet && !wallet.isLocal()) {
        // Blockchain wallet - check blockchain sync setting
        const settings = await StorageService.getSettings();
        // Only set toBePush=true if blockchain sync is enabled AND hash is null (new service)
        newSharedKey.toBePush = (settings.blockchainSync && !newSharedKey.hash) || false;
      } else {
        // Local wallet - always false
        newSharedKey.toBePush = false;
      }
      
      console.log('Creating new SharedKey:', {
        name: newSharedKey.name,
        hash: newSharedKey.hash,
        isLocal: newSharedKey.isLocal,
        revokeInQueue: newSharedKey.revokeInQueue,
        toBePush: newSharedKey.toBePush
      });

      const updatedSharedKeys = [...sharedKeys, newSharedKey];
      setSharedKeys(updatedSharedKeys);
      
      await StorageService.saveSharedKeys(updatedSharedKeys);
      setShowAddModal(false);
      
      if (newSharedKey.toBePush) {
        Alert.alert('Success', 'Service added! It will be automatically saved to blockchain.');
        
        // Force CronBuddy to check immediately for the new key
        try {
          console.log('DEBUG: New service with toBePush=true, triggering CronBuddy check');
          await CronBuddy.forceCheck();
        } catch (error) {
          console.error('DEBUG: Error triggering CronBuddy for new service:', error);
        }
      } else {
        Alert.alert('Success', 'Service added locally! Enable blockchain sync or use individual save buttons to sync to blockchain.');
      }
    } catch (error) {
      console.error('Error adding service:', error);
      Alert.alert('Error', 'Failed to add service. Please try again.');
    }
  };

  const handleBroadcastCode = async (sharedKeyHash: string, futureCode?: string) => {
    const sharedKey = sharedKeys.find(sk => sk.hash === sharedKeyHash || sk.name + '_' + sk.timeStampSharedKeyCreate === sharedKeyHash);
    if (!sharedKey) return;

    try {
      // Get broadcast address from settings
      const settings = await StorageService.getSettings();
      const broadcastAddress = settings.broadcastAddress || wallet?.getPublicAddress();
      
      if (!broadcastAddress) {
        Alert.alert('Error', 'No broadcast address configured. Please set one in Settings.');
        return;
      }

      // Call WalletService.broadcast()
      const success = await WalletService.broadcast(
        broadcastAddress,
        sharedKey.code,
        sharedKey.name,
        sharedKey.timeRemaining,
        futureCode // Pass future code if available
      );

      if (success) {
        // Trigger pulsing animation on the service card
        const serviceCardRef = serviceCardRefs.current[sharedKeyHash];
        if (serviceCardRef && serviceCardRef.triggerPulse) {
          serviceCardRef.triggerPulse();
        }
        
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to broadcast code.');
    }
  };

  const handleSaveToBlockchain = async (sharedKeyId: string) => {
    const sharedKey = sharedKeys.find(sk => sk.hash === sharedKeyId || sk.name + '_' + sk.timeStampSharedKeyCreate === sharedKeyId);
    if (!sharedKey) return;

    try {
      // Check if wallet is blockchain-enabled
      if (!wallet || wallet.isLocal()) {
        Alert.alert('Error', 'Blockchain features require a blockchain wallet. Please upgrade your wallet first.');
        return;
      }

      // Check if shared key is already on blockchain
      if (!sharedKey.isLocal) {
        Alert.alert('Info', 'This service is already saved on the blockchain.');
        return;
      }

      // Set toBePush flag to true - CronBuddy will handle the rest
      sharedKey.toBePush = true;
      console.log('DEBUG: Set toBePush=true for sharedKey:', sharedKey.name, 'toBePush:', sharedKey.toBePush);
      
      const updatedSharedKeys = sharedKeys.map(sk => 
        sk === sharedKey ? sharedKey : sk
      );
      
      setSharedKeys(updatedSharedKeys);
      await StorageService.saveSharedKeys(updatedSharedKeys);
      console.log('DEBUG: Saved sharedKeys to storage, toBePush flag should be persisted');
      
      // Verify the flag was saved
      const savedKeys = await StorageService.getSharedKeys();
      const savedKey = savedKeys.find(sk => sk.name === sharedKey.name);
      console.log('DEBUG: Verified saved key toBePush flag:', savedKey?.toBePush);
      
      // Ensure CronBuddy is running
      if (!CronBuddy.isActive()) {
        console.log('DEBUG: CronBuddy not active, starting it...');
        CronBuddy.start();
        console.log('DEBUG: CronBuddy started, is now active:', CronBuddy.isActive());
      } else {
        console.log('DEBUG: CronBuddy already active');
      }
      
      Alert.alert('Success', 'Service will be saved to blockchain automatically. CronBuddy will process this in the background.');
      
      // Debug: Check CronBuddy status and force a check
      console.log('DEBUG: CronBuddy is active:', CronBuddy.isActive());
      console.log('DEBUG: Wallet is local:', wallet?.isLocal());
      console.log('DEBUG: Wallet sync status:', WalletService.getWalletSyncStatus());
      
      // Force CronBuddy to check immediately
      try {
        await CronBuddy.forceCheck();
        console.log('DEBUG: CronBuddy force check completed');
      } catch (error) {
        console.error('DEBUG: CronBuddy force check failed:', error);
      }
      
    } catch (error) {
      console.error('Error saving to blockchain:', error);
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
      if (sharedKey.isLocal) {
        // Simply delete local-only SharedKeys
        const updatedSharedKeys = sharedKeys.filter(sk => sk !== sharedKey);
        setSharedKeys(updatedSharedKeys);
        await StorageService.saveSharedKeys(updatedSharedKeys);
      } else {
        // SharedKey is on blockchain, set revokeInQueue and hide from screen
        sharedKey.revokeInQueue = true;
        sharedKey.timeStampSharedKeyRevoke = Date.now(); // Set immediately to prevent gap
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
    /*
    console.log('Checking display for SharedKey:', {
      name: sharedKey.name,
      hash: sharedKey.hash,
      isLocal: sharedKey.isLocal,
      revokeInQueue: sharedKey.revokeInQueue,
      timeStampSharedKeyRevoke: sharedKey.timeStampSharedKeyRevoke,
      extraStatus: sharedKey.extraStatus,
      extraSharedKey: sharedKey.extraSharedKey,
      toBePush: sharedKey.toBePush
    });   
    */
    // PRIMARY RULE: Don't display if revoked (either in queue OR confirmed revoked)
    if (sharedKey.revokeInQueue || sharedKey.timeStampSharedKeyRevoke > 0) {
      console.log('Hidden: Service is revoked (revokeInQueue or timeStampSharedKeyRevoke)');
      return false;
    }
   
      return true;
   
  };

  // Styles are now handled by Tailwind CSS classes

  const renderContent = () => {

    return (
      <>
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
            <FundingBanner 
              balance={balance}
              maxKeys={maxKeys}
              onPress={() => {/* Navigate to wallet tab or show funding info */}}
            />
            
            {/* Services Grid */}
            <View className="py-4">
              {!isAuthenticated ? (
                <View className="flex-1 items-center justify-center py-20">
                  <Ionicons name="lock-closed" size={64} color={theme.colors.textSecondary} />
                  <Text className="text-xl font-semibold mt-4 mb-2" style={{ color: theme.colors.text }}>
                    Authentication Required
                  </Text>
                </View>
              ) : sharedKeys.length === 0 ? (
                <View className="flex-1 items-center justify-center py-20">
                  <Ionicons name="shield-outline" size={64} color={theme.colors.textSecondary} />
                  <Text className="text-xl font-semibold mt-4 mb-2" style={{ color: theme.colors.text }}>
                    No 2FA Services Added
                  </Text>
                  <Text className="text-base text-center leading-6 px-8" style={{ color: theme.colors.textSecondary }}>
                    Tap the + button to add your first 2FA service
                  </Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap justify-between">
                  {sharedKeys
                    .filter(shouldDisplaySharedKey)
                    .map((sharedKey) => {
                      const sharedKeyId = sharedKey.hash || sharedKey.name + '_' + sharedKey.timeStampSharedKeyCreate;                      
                      return (
                        <ServiceCard
                          key={sharedKeyId}
                          ref={(ref) => {
                            if (ref) {
                              serviceCardRefs.current[sharedKeyId] = ref;
                            }
                          }}
                          sharedKey={sharedKey}
                          isSelected={selectedServiceId === sharedKeyId}
                          walletBalance={balance}
                          blockchainSyncEnabled={blockchainSyncEnabled}
                          onCopy={() => handleCopyCode(sharedKey.code, sharedKey.name)}
                          onDelete={() => handleDeleteSharedKey(sharedKeyId)}
                          onSelect={() => handleSelectSharedKey(sharedKeyId)}
                          onBroadcast={(futureCode) => handleBroadcastCode(sharedKeyId, futureCode)}
                          onSaveToBlockchain={() => handleSaveToBlockchain(sharedKeyId)}
                        />
                      );
                    })}
                </View>
              )}
            </View>
          </ScrollView>

        <AddServiceModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddService}
        />
        
        {/* Floating Action Button */}
        <TouchableOpacity
          className="absolute bottom-5 right-5 w-14 h-14 rounded-full justify-center items-center shadow-lg z-50"
          style={{ backgroundColor: theme.colors.primary }}
          onPress={() => {
            if (Platform.OS === 'ios') {
              setTimeout(() => setShowAddModal(true), 200);
            } else {
              setShowAddModal(true);
            }
          }}
        >
          <Ionicons name="add" size={24} color={theme.colors.background} />
        </TouchableOpacity>
      </>
    );
  };

  return (
    <GestureNavigator>
      <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
        <Header title="Authenticator" />
        {renderContent()}
      </View>
    </GestureNavigator>
  );
}
