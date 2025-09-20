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
import { SharedKey } from '../model/Transaction';
import { useWallet } from '../contexts/WalletContext';
import { useTheme } from '../contexts/ThemeContext';
import GestureNavigator from '../components/GestureNavigator';

export default function HomeScreen() {
  const [sharedKeys, setSharedKeys] = useState<SharedKey[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const { balance, maxKeys, isAuthenticated, authenticate } = useWallet();
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

  const updateCodes = async () => {
    console.log('updateCodes called, current sharedKeys count:', sharedKeys.length);
    setSharedKeys(prevSharedKeys => {
      Promise.all(prevSharedKeys.map(async sharedKey => {
        /*console.log('Updating SharedKey:', {
          name: sharedKey.name,
          hash: sharedKey.hash,
          isLocal: sharedKey.isLocalOnly(),
          revokeInQueue: sharedKey.revokeInQueue
        });
        */
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
        // console.log('Setting updated sharedKeys, count:', updatedSharedKeys.length);
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
      
      console.log('Creating new SharedKey:', {
        name: newSharedKey.name,
        hash: newSharedKey.hash,
        isLocal: newSharedKey.isLocalOnly(),
        revokeInQueue: newSharedKey.revokeInQueue
      });

      const updatedSharedKeys = [...sharedKeys, newSharedKey];
      setSharedKeys(updatedSharedKeys);
      
      await StorageService.saveSharedKeys(updatedSharedKeys);
      setShowAddModal(false);
      
      Alert.alert('Success', 'Service added locally! Sync to blockchain when you have CCX balance.');
    } catch (error) {
      console.error('Error adding service:', error);
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
      // TODO: Implement blockchain transaction creation
      // For now, just show a placeholder message
      Alert.alert('Coming Soon', 'Blockchain integration will be available soon!');
      
      const updatedSharedKeys = sharedKeys.map(sk => 
        sk === sharedKey ? sharedKey : sk
      );
      
      setSharedKeys(updatedSharedKeys);
      await StorageService.saveSharedKeys(updatedSharedKeys);
      
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
    console.log('Checking display for SharedKey:', {
      name: sharedKey.name,
      hash: sharedKey.hash,
      isLocal: sharedKey.isLocalOnly(),
      revokeInQueue: sharedKey.revokeInQueue,
      extraStatus: sharedKey.extraStatus,
      extraSharedKey: sharedKey.extraSharedKey
    });   
    // 1. isLocal() (hash === '') and revokeInQueue = false -> Display
    if (sharedKey.isLocalOnly() && !sharedKey.revokeInQueue) {
      //console.log('Display: Local card, not in revoke queue');
      return true;
    }
    
    // 2. !isLocal() and revokeInQueue = true -> Hidden
    if (!sharedKey.isLocalOnly() && sharedKey.revokeInQueue) {
      console.log('Hidden: Blockchain card in revoke queue');
      return false;
    }
    
    // 4. extraStatus = ff02 (revoke transactions) -> Never display
    if (!sharedKey.isLocalOnly() && sharedKey.extraStatus === 'ff02') {
      console.log('Hidden: Revoke transaction');
      return false;
    }
    
    // 5. Check if there's a matching revoke transaction
    const hasMatchingRevokeTransaction = sharedKeys.some(sk => 
      sk.extraStatus === 'ff02' && 
      sk.extraSharedKey !== ''
    );
    
    if (hasMatchingRevokeTransaction) {
      console.log('Hidden: Has matching revoke transaction');
      return false;
    }
    
    // 3. !isLocal() and revokeInQueue = false -> Display (if not revoked)
    if (!sharedKey.isLocalOnly() && !sharedKey.revokeInQueue) {
      console.log('Display: Blockchain card, not revoked');
      return true;
    }
    
    // Default: don't display
    console.log('Hidden: Default case');
    return false;
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
                          sharedKey={sharedKey}
                          isSelected={selectedServiceId === sharedKeyId}
                          walletBalance={balance}
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
          onPress={() => setShowAddModal(true)}
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
