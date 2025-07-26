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
import { useWallet } from '../contexts/WalletContext';
import { useTheme } from '../contexts/ThemeContext';

interface Service {
  id: string;
  name: string;
  issuer: string;
  secret: string;
  code: string;
  timeRemaining: number;
  isLocalOnly: boolean;
  blockchainTxHash?: string;
}

export default function HomeScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const { balance, maxKeys } = useWallet();
  const { theme } = useTheme();

  useEffect(() => {
    loadServices();
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
      updateCodes();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadServices = async () => {
    try {
      const savedServices = await StorageService.getServices();
      setServices(savedServices.map(service => ({
        ...service,
        code: TOTPService.generateTOTP(service.secret),
        timeRemaining: TOTPService.getTimeRemaining(),
      })));
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const updateCodes = () => {
    setServices(prevServices => 
      prevServices.map(service => ({
        ...service,
        code: TOTPService.generateTOTP(service.secret),
        timeRemaining: TOTPService.getTimeRemaining(),
      }))
    );
  };

  const handleAddService = async (serviceData: { name: string; issuer: string; secret: string }) => {
    try {
      const newService = {
        id: Date.now().toString(),
        ...serviceData,
        code: TOTPService.generateTOTP(serviceData.secret),
        timeRemaining: TOTPService.getTimeRemaining(),
        isLocalOnly: true, // Always start as local-only
      };

      const updatedServices = [...services, newService];
      setServices(updatedServices);
      
      await StorageService.saveServices(updatedServices);
      setShowAddModal(false);
      
      Alert.alert('Success', 'Service added locally! Sync to blockchain when you have CCX balance.');
    } catch (error) {
      Alert.alert('Error', 'Failed to add service. Please try again.');
    }
  };

  const handleBroadcastToMyself = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    try {
      // Simulate broadcasting to blockchain mempool with 30s TTL
      Alert.alert(
        'Code Broadcasted',
        `${service.name} code (${service.code}) broadcasted to blockchain mempool for 30 seconds. Your other devices can now access it.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to broadcast code.');
    }
  };

  const handleSaveToBlockchain = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    try {
      // Simulate saving to blockchain
      const updatedServices = services.map(s => 
        s.id === serviceId 
          ? { ...s, isLocalOnly: false, blockchainTxHash: 'mock_tx_hash_' + Date.now() }
          : s
      );
      
      setServices(updatedServices);
      await StorageService.saveServices(updatedServices);
      
      Alert.alert('Success', `${service.name} key saved to blockchain successfully!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save key to blockchain.');
    }
  };

  const handleCopyCode = async (code: string, serviceName: string) => {
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert('Copied', `${serviceName} code copied to clipboard!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy code to clipboard.');
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const updatedServices = services.filter(service => service.id !== serviceId);
      setServices(updatedServices);
      await StorageService.saveServices(updatedServices);
      if (selectedServiceId === serviceId) {
        setSelectedServiceId(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete service.');
    }
  };

  const handleSelectService = (serviceId: string) => {
    setSelectedServiceId(selectedServiceId === serviceId ? null : serviceId);
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

        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Services Added</Text>
            <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
              Add your first 2FA service by tapping the + button below. Keys are stored locally first.
            </Text>
          </View>
        ) : (
          <View style={styles.servicesList}>
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                isSelected={selectedServiceId === service.id}
                walletBalance={balance}
                isWalletSynced={isWalletSynced}
                onCopy={() => handleCopyCode(service.code, service.name)}
                onDelete={() => handleDeleteService(service.id)}
                onSelect={() => handleSelectService(service.id)}
                onBroadcast={() => handleBroadcastToMyself(service.id)}
                onSaveToBlockchain={() => handleSaveToBlockchain(service.id)}
              />
            ))}
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