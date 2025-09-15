import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

const { width, height } = Dimensions.get('window');

export interface SeedInputModalProps {
  visible: boolean;
  onCancel: () => void;
  onImport: (seedPhrase: string, creationHeight?: number) => void;
}

export const SeedInputModal: React.FC<SeedInputModalProps> = ({
  visible,
  onCancel,
  onImport,
}) => {
  const [seedPhrase, setSeedPhrase] = useState('');
  const [creationHeight, setCreationHeight] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handlePaste = async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent) {
        setSeedPhrase(clipboardContent.trim());
      }
    } catch (error) {
      console.error('Error pasting from clipboard:', error);
      Alert.alert('Error', 'Failed to paste from clipboard');
    }
  };

  const validateSeedPhrase = (phrase: string): boolean => {
    const words = phrase.trim().split(/\s+/);
    return words.length === 25;
  };

  const handleImport = () => {
    if (!seedPhrase.trim()) {
      Alert.alert('Error', 'Please enter a seed phrase');
      return;
    }

    if (!validateSeedPhrase(seedPhrase)) {
      Alert.alert('Error', 'Seed phrase must contain exactly 25 words');
      return;
    }

    // Parse creation height (default to 0 if empty or invalid)
    let height = 0;
    if (creationHeight.trim()) {
      const parsedHeight = parseInt(creationHeight.trim());
      if (!isNaN(parsedHeight) && parsedHeight >= 0) {
        height = parsedHeight;
      }
    }

    setIsValidating(true);
    onImport(seedPhrase.trim(), height);
    setIsValidating(false);
  };

  const handleCancel = () => {
    setSeedPhrase('');
    setCreationHeight('');
    onCancel();
  };

  const wordCount = seedPhrase.trim().split(/\s+/).filter(word => word.length > 0).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.blurContainer}>
          <View style={styles.modalContainer}>
            <Text style={styles.title}>Import Wallet</Text>
            <Text style={styles.subtitle}>Enter your 25-word seed phrase</Text>
            
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Text style={styles.inputLabel}>Seed Phrase</Text>
                <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
                  <Text style={styles.pasteButtonText}>📋 Paste</Text>
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.textInput}
                value={seedPhrase}
                onChangeText={setSeedPhrase}
                placeholder="Enter your 25-word seed phrase here..."
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={false}
              />
              
              <View style={styles.wordCountContainer}>
                <Text style={[
                  styles.wordCount,
                  wordCount === 25 ? styles.wordCountValid : styles.wordCountInvalid
                ]}>
                  {wordCount}/25 words
                </Text>
                {wordCount === 25 && (
                  <Text style={styles.validIndicator}>✓ Valid</Text>
                )}
              </View>
            </View>

            <View style={styles.heightContainer}>
              <Text style={styles.heightLabel}>Creation Height (Optional)</Text>
              <TextInput
                style={styles.heightInput}
                value={creationHeight}
                onChangeText={setCreationHeight}
                placeholder="Enter wallet creation height (leave blank for 0)"
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.heightHint}>
                Enter the blockchain height when your wallet was created
              </Text>
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={isValidating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.button, 
                  styles.importButton,
                  wordCount !== 25 && styles.importButtonDisabled
                ]}
                onPress={handleImport}
                disabled={isValidating || wordCount !== 25}
              >
                <Text style={[
                  styles.importButtonText,
                  wordCount !== 25 && styles.importButtonTextDisabled
                ]}>
                  {isValidating ? 'Importing...' : 'Import'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pasteButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pasteButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    backgroundColor: '#fafafa',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  wordCountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  wordCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  wordCountValid: {
    color: '#28a745',
  },
  wordCountInvalid: {
    color: '#dc3545',
  },
  validIndicator: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
  },
  heightContainer: {
    marginBottom: 24,
  },
  heightLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  heightInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  heightHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  importButton: {
    backgroundColor: '#007AFF',
  },
  importButtonDisabled: {
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  importButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  importButtonTextDisabled: {
    color: '#999',
  },
});
