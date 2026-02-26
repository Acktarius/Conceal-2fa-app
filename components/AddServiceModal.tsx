import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { StorageService } from '../services/StorageService';
import { QRScannerContent } from './QRScannerModal';

export type TOTPAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';
export type TOTPDigits = 6 | 7 | 8;
export type TOTPPeriod = 30 | 60;

export interface AddServicePayload {
  name: string;
  issuer: string;
  secret: string;
  algorithm: TOTPAlgorithm;
  digits: TOTPDigits;
  period: TOTPPeriod;
}

interface AddServiceModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (service: AddServicePayload) => void;
}

const ALGORITHM_OPTIONS: TOTPAlgorithm[] = ['SHA1', 'SHA256', 'SHA512'];
const DIGITS_OPTIONS: TOTPDigits[] = [6, 7, 8];
const PERIOD_OPTIONS: TOTPPeriod[] = [30, 60];

export default function AddServiceModal({ visible, onClose, onAdd }: AddServiceModalProps) {
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [secret, setSecret] = useState('');
  const [algorithm, setAlgorithm] = useState<TOTPAlgorithm>('SHA1');
  const [digits, setDigits] = useState<TOTPDigits>(6);
  const [period, setPeriod] = useState<TOTPPeriod>(30);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<'algorithm' | 'digits' | 'period' | null>(null);
  const { theme } = useTheme();

  const payload = (): AddServicePayload => ({
    name: name.trim(),
    issuer: issuer.trim() || 'Unknown',
    secret: secret.trim(),
    algorithm,
    digits,
    period,
  });

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
              onAdd(payload());
              setName('');
              setIssuer('');
              setSecret('');
            },
          },
        ]);
        return;
      }

      // No duplicate found, proceed with normal add
      onAdd(payload());
      setName('');
      setIssuer('');
      setSecret('');
    } catch (error) {
      console.error('Error checking for duplicate services:', error);
      Alert.alert('Error', 'Failed to check for existing services. Please try again.');
    }
  };

  const handleClose = () => {
    setName('');
    setIssuer('');
    setSecret('');
    setAlgorithm('SHA1');
    setDigits(6);
    setPeriod(30);
    setScannerOpen(false);
    setDropdownOpen(null);
    onClose();
  };

  const handleQRScan = (data: string) => {
    try {
      const url = new URL(data);
      if (url.protocol === 'otpauth:' && url.hostname === 'totp') {
        const pathParts = url.pathname.slice(1).split(':');
        const serviceName = pathParts[pathParts.length - 1] || 'Unknown Service';
        const issuerName = url.searchParams.get('issuer') || pathParts[0] || 'Unknown';
        const secretKey = url.searchParams.get('secret');
        if (!secretKey) {
          Alert.alert('Error', 'Invalid QR code: No secret key found.');
          return;
        }  
          // Raw values from query with string defaults
          const algorithmParam = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase(); // e.g. "SHA1", "SHA256", "SHA512"
          const digitsParam = url.searchParams.get('digits') || '6';
          const periodParam = url.searchParams.get('period') || '30';

          // Normalize / validate algorithm
          let algorithm: 'SHA1' | 'SHA256' | 'SHA512';
          if (algorithmParam === 'SHA1' || algorithmParam === 'SHA256' || algorithmParam === 'SHA512') {
            algorithm = algorithmParam;
          } else {
            Alert.alert('Error', `Unsupported TOTP algorithm: ${algorithmParam}`);
            return;
          }

          // Normalize / validate digits (default 6)
          const digitsNum = parseInt(digitsParam, 10);
          if (Number.isNaN(digitsNum) || digitsNum < 6 || digitsNum > 8) {
            Alert.alert('Error', `Unsupported TOTP digits value: ${digitsParam}`);
            return;
          }
          const digits = digitsNum as TOTPDigits;

          // Normalize / validate period (default 30)
          const periodNum = parseInt(periodParam, 10);
          if (Number.isNaN(periodNum) || periodNum <= 0) {
            Alert.alert('Error', `Invalid TOTP period: ${periodParam}`);
            return;
          }
          const period = (periodNum === 60 ? 60 : 30) as TOTPPeriod;

          // then store everything
          setAlgorithm(algorithm);
          setDigits(digits);
          setPeriod(period);


          setName(decodeURIComponent(serviceName));
          setIssuer(decodeURIComponent(issuerName));
          setSecret(secretKey);
          setScannerOpen(false);

      } else {
        Alert.alert('Error', 'Invalid QR code format. Please scan a valid 2FA QR code.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to parse QR code. Please try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      {scannerOpen ? (
        <QRScannerContent
          onClose={() => setScannerOpen(false)}
          onScan={handleQRScan}
          isActive={true}
        />
      ) : (
        <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
          <View
            className="flex-row items-center justify-center px-5 pt-12 pb-4 border-b"
            style={{
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.border,
            }}
          >
            <Text className="text-lg font-semibold font-poppins-medium" style={{ color: theme.colors.text }}>
              Add Service
            </Text>
          </View>

          <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <TouchableOpacity
              className="flex-row items-center justify-center rounded-2xl p-5 mb-6"
              style={{ backgroundColor: theme.colors.primaryLight }}
              onPress={() => setScannerOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={24} color={theme.colors.primary} />
              <Text className="text-base font-semibold ml-2 font-poppins-medium" style={{ color: theme.colors.primary }}>
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
              <View className="mb-4">
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

              <View className="mb-4">
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

              <View className="mb-4">
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

              <View className="mb-4">
                <Text className="text-base font-medium mb-2 font-poppins-medium" style={{ color: theme.colors.text }}>
                  Algorithm
                </Text>
                <TouchableOpacity
                  className="rounded-xl p-4 flex-row items-center justify-between border"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  }}
                  onPress={() => setDropdownOpen('algorithm')}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: theme.colors.text }}>{algorithm}</Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View className="mb-4">
                <Text className="text-base font-medium mb-2 font-poppins-medium" style={{ color: theme.colors.text }}>
                  Digits
                </Text>
                <TouchableOpacity
                  className="rounded-xl p-4 flex-row items-center justify-between border"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  }}
                  onPress={() => setDropdownOpen('digits')}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: theme.colors.text }}>{digits}</Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View className="mb-4">
                <Text className="text-base font-medium mb-2 font-poppins-medium" style={{ color: theme.colors.text }}>
                  Period (seconds)
                </Text>
                <TouchableOpacity
                  className="rounded-xl p-4 flex-row items-center justify-between border"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  }}
                  onPress={() => setDropdownOpen('period')}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: theme.colors.text }}>{period}</Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              className="rounded-2xl p-4 items-center mb-4"
              style={[
                { backgroundColor: theme.colors.primary },
                (!name.trim() || !secret.trim()) && { backgroundColor: theme.colors.textSecondary, opacity: 0.5 },
              ]}
              onPress={handleAdd}
              disabled={!name.trim() || !secret.trim()}
              activeOpacity={0.8}
            >
              <Text className="text-base font-semibold font-poppins-medium" style={{ color: theme.isDark ? '#000000' : '#FFFFFF' }}>
                Add Service
              </Text>
            </TouchableOpacity>
          </ScrollView>

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
      )}

      {/* Dropdown overlay (same modal, no second modal) */}
      {dropdownOpen !== null && (
        <TouchableOpacity
          className="absolute inset-0 bg-black/50"
          style={{ justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setDropdownOpen(null)}
        >
          <View
            className="rounded-t-2xl p-4 pb-8"
            style={{ backgroundColor: theme.colors.surface }}
            onStartShouldSetResponder={() => true}
          >
            {dropdownOpen === 'algorithm' &&
              ALGORITHM_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  className="py-4 px-4 rounded-xl"
                  style={{ backgroundColor: algorithm === opt ? theme.colors.primaryLight : 'transparent' }}
                  onPress={() => {
                    setAlgorithm(opt);
                    setDropdownOpen(null);
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontSize: 16 }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            {dropdownOpen === 'digits' &&
              DIGITS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  className="py-4 px-4 rounded-xl"
                  style={{ backgroundColor: digits === opt ? theme.colors.primaryLight : 'transparent' }}
                  onPress={() => {
                    setDigits(opt);
                    setDropdownOpen(null);
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontSize: 16 }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            {dropdownOpen === 'period' &&
              PERIOD_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  className="py-4 px-4 rounded-xl"
                  style={{ backgroundColor: period === opt ? theme.colors.primaryLight : 'transparent' }}
                  onPress={() => {
                    setPeriod(opt);
                    setDropdownOpen(null);
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontSize: 16 }}>{opt} seconds</Text>
                </TouchableOpacity>
              ))}
          </View>
        </TouchableOpacity>
      )}
    </Modal>
  );
}
