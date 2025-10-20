import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { StorageService } from '../services/StorageService';
import QRScannerModal from './QRScannerModal';

interface AddServiceModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (service: { name: string; issuer: string; secret: string }) => void;
}

export default function AddServiceModal({ visible, onClose, onAdd }: AddServiceModalProps) {
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [secret, setSecret] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const { theme } = useTheme();

  const handleAdd = async () => {
    if (!name.trim() || !secret.trim()) {
      Alert.alert('Error', 'Please fill in the service name and secret key.');
      return;
    }

    try {
      // Check for existing services with the same secret
      const existingSharedKeys = await StorageService.getSharedKeys();
      const duplicateService = existingSharedKeys.find((sk) => sk.secret === secret.trim());

      if (duplicateService) {
        // Show replace/cancel alert
        Alert.alert('Service Already Installed', 'Do you want to replace or Cancel?', [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: handleClose,
          },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: async () => {
              // Remove the existing service and add the new one
              const updatedSharedKeys = existingSharedKeys.filter((sk) => sk.secret !== secret.trim());
              await StorageService.saveSharedKeys(updatedSharedKeys);

              // Add the new service
              onAdd({
                name: name.trim(),
                issuer: issuer.trim() || 'Unknown',
                secret: secret.trim(),
              });

              // Reset form
              setName('');
              setIssuer('');
              setSecret('');
            },
          },
        ]);
        return;
      }

      // No duplicate found, proceed with normal add
      onAdd({
        name: name.trim(),
        issuer: issuer.trim() || 'Unknown',
        secret: secret.trim(),
      });

      // Reset form
      setName('');
      setIssuer('');
      setSecret('');
    } catch (error) {
      console.error('Error checking for duplicate services:', error);
      Alert.alert('Error', 'Failed to check for existing services. Please try again.');
    }
  };

  const handleClose = () => {
    // Reset all fields when closing
    setName('');
    setIssuer('');
    setSecret('');
    setShowScanner(false);
    onClose();
  };

  const handleQRScan = (data: string) => {
    try {
      // Parse TOTP URI format: otpauth://totp/Service:account?secret=XXXXX&issuer=Service
      const url = new URL(data);

      if (url.protocol === 'otpauth:' && url.hostname === 'totp') {
        const pathParts = url.pathname.slice(1).split(':');
        const serviceName = pathParts[pathParts.length - 1] || 'Unknown Service';
        const issuerName = url.searchParams.get('issuer') || pathParts[0] || 'Unknown';
        const secretKey = url.searchParams.get('secret');

        if (secretKey) {
          // Decode URI-encoded strings for both service name and issuer
          const decodedServiceName = decodeURIComponent(serviceName);
          const decodedIssuerName = decodeURIComponent(issuerName);

          setName(decodedServiceName);
          setIssuer(decodedIssuerName);
          setSecret(secretKey);
          setShowScanner(false);
        } else {
          Alert.alert('Error', 'Invalid QR code: No secret key found.');
        }
      } else {
        Alert.alert('Error', 'Invalid QR code format. Please scan a valid 2FA QR code.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to parse QR code. Please try again.');
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
        <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
          <View
            className="flex-row items-center justify-center px-5 pt-5 pb-4 border-b"
            style={{
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.border,
            }}
          >
            <Text className="text-lg font-semibold font-poppins-medium" style={{ color: theme.colors.text }}>
              Add Service
            </Text>
          </View>

          <View className="flex-1 p-5">
            <TouchableOpacity
              className="flex-row items-center justify-center rounded-2xl p-5 mb-6"
              style={{ backgroundColor: theme.colors.primaryLight }}
              onPress={() => setShowScanner(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={24} color={theme.colors.primary} />
              <Text
                className="text-base font-semibold ml-2 font-poppins-medium"
                style={{ color: theme.colors.primary }}
              >
                Scan QR Code
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center mb-6">
              <View className="flex-1 h-px" style={{ backgroundColor: theme.colors.border }} />
              <Text className="text-sm mx-4 font-poppins" style={{ color: theme.colors.textSecondary }}>
                or enter manually
              </Text>
              <View className="flex-1 h-px" style={{ backgroundColor: theme.colors.border }} />
            </View>

            <View className="mb-8">
              <View className="mb-5">
                <Text className="text-base font-medium mb-2 font-poppins-medium" style={{ color: theme.colors.text }}>
                  Service Name *
                </Text>
                <TextInput
                  className="rounded-xl p-4 text-base border"
                  style={{
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                  }}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Google, GitHub, etc."
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>

              <View className="mb-5">
                <Text className="text-base font-medium mb-2 font-poppins-medium" style={{ color: theme.colors.text }}>
                  Issuer (Optional)
                </Text>
                <TextInput
                  className="rounded-xl p-4 text-base border"
                  style={{
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                  }}
                  value={issuer}
                  onChangeText={setIssuer}
                  placeholder="e.g., Google Inc."
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>

              <View className="mb-5">
                <Text className="text-base font-medium mb-2 font-poppins-medium" style={{ color: theme.colors.text }}>
                  Secret Key *
                </Text>
                <TextInput
                  className="rounded-xl p-4 text-base border"
                  style={{
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                  }}
                  value={secret}
                  onChangeText={setSecret}
                  placeholder="Enter the secret key"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <TouchableOpacity
              className="rounded-2xl p-4 items-center"
              style={[
                { backgroundColor: theme.colors.primary },
                (!name.trim() || !secret.trim()) && { backgroundColor: theme.colors.textSecondary, opacity: 0.5 },
              ]}
              onPress={handleAdd}
              disabled={!name.trim() || !secret.trim()}
              activeOpacity={0.8}
            >
              <Text
                className="text-base font-semibold font-poppins-medium"
                style={{ color: theme.isDark ? '#000000' : '#FFFFFF' }}
              >
                Add Service
              </Text>
            </TouchableOpacity>
          </View>

          {/* Floating Close Button */}
          <TouchableOpacity
            className="absolute bottom-12 right-6 w-12 h-12 rounded-full items-center justify-center shadow-lg"
            style={{ backgroundColor: theme.colors.surface }}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </Modal>

      <QRScannerModal visible={showScanner} onClose={() => setShowScanner(false)} onScan={handleQRScan} />
    </>
  );
}
