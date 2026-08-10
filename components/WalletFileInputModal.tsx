import * as Clipboard from 'expo-clipboard';
import type React from 'react';
import { useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

export interface WalletFileInputModalProps {
  visible: boolean;
  onCancel: () => void;
  onImport: (fileContent: string) => void;
}

export const WalletFileInputModal: React.FC<WalletFileInputModalProps> = ({ visible, onCancel, onImport }) => {
  const [fileContent, setFileContent] = useState('');

  const handlePaste = async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent) {
        setFileContent(clipboardContent.trim());
      }
    } catch (error) {
      console.error('Error pasting from clipboard:', error);
      Alert.alert('Error', 'Failed to paste from clipboard');
    }
  };

  const handleImport = () => {
    if (!fileContent.trim()) {
      Alert.alert('Error', 'Please paste your wallet backup file content');
      return;
    }
    onImport(fileContent.trim());
  };

  const handleCancel = () => {
    setFileContent('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.blurContainer}>
          <View style={styles.modalContainer}>
            <Text style={styles.title}>Import Wallet from File</Text>
            <Text style={styles.subtitle}>Paste the contents of your encrypted wallet backup JSON file</Text>

            <View style={styles.inputHeader}>
              <Text style={styles.inputLabel}>Wallet backup JSON</Text>
              <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
                <Text style={styles.pasteButtonText}>Paste</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textInput}
              value={fileContent}
              onChangeText={setFileContent}
              placeholder='Paste JSON with "data" and "nonce" fields...'
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.importButton, !fileContent.trim() && styles.importButtonDisabled]}
                onPress={handleImport}
                disabled={!fileContent.trim()}
              >
                <Text style={[styles.importButtonText, !fileContent.trim() && styles.importButtonTextDisabled]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  blurContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: width * 0.9,
    maxWidth: 500,
  },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 },
  inputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  pasteButton: { backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  pasteButtonText: { fontSize: 14, color: '#007AFF', fontWeight: '500' },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 140,
    backgroundColor: '#fafafa',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 16,
  },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, marginHorizontal: 4 },
  cancelButton: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd' },
  importButton: { backgroundColor: '#007AFF' },
  importButtonDisabled: { backgroundColor: '#ccc' },
  cancelButtonText: { color: '#666', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  importButtonText: { color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  importButtonTextDisabled: { color: '#999' },
});
