import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import QRScannerModal from './QRScannerModal';
import { useTheme } from '../contexts/ThemeContext';

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

  const styles = createStyles(theme);

  const handleAdd = () => {
    if (!name.trim() || !secret.trim()) {
      Alert.alert('Error', 'Please fill in the service name and secret key.');
      return;
    }

    onAdd({
      name: name.trim(),
      issuer: issuer.trim() || 'Unknown',
      secret: secret.trim(),
    });

    setName('');
    setIssuer('');
    setSecret('');
  };

  const handleQRScan = (data: string) => {
    try {
      const url = new URL(data);
      
      if (url.protocol === 'otpauth:' && url.hostname === 'totp') {
        const pathParts = url.pathname.slice(1).split(':');
        const serviceName = pathParts[pathParts.length - 1] || 'Unknown Service';
        const issuerName = url.searchParams.get('issuer') || pathParts[0] || 'Unknown';
        const secretKey = url.searchParams.get('secret');

        if (secretKey) {
          setName(serviceName);
          setIssuer(issuerName);
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
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.colors.text }]}>Add Service</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.content}>
            <TouchableOpacity
              style={[styles.scanButton, { backgroundColor: theme.colors.primaryLight }]}
              onPress={() => setShowScanner(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={24} color={theme.colors.primary} />
              <Text style={[styles.scanButtonText, { color: theme.colors.primary }]}>Scan QR Code</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
              <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>or enter manually</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Service Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Google, GitHub, etc."
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Issuer (Optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                  value={issuer}
                  onChangeText={setIssuer}
                  placeholder="e.g., Google Inc."
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Secret Key *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
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
              style={[
                styles.addButton, 
                { backgroundColor: theme.colors.primary },
                (!name.trim() || !secret.trim()) && { backgroundColor: theme.colors.textSecondary, opacity: 0.5 }
              ]}
              onPress={handleAdd}
              disabled={!name.trim() || !secret.trim()}
              activeOpacity={0.8}
            >
              <Text style={[styles.addButtonText, { color: theme.isDark ? '#000000' : '#FFFFFF' }]}>Add Service</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <QRScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />
    </>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    marginHorizontal: 16,
  },
  form: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  addButton: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});