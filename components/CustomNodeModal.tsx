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
import { config } from '../config';

const { width, height } = Dimensions.get('window');

export interface CustomNodeModalProps {
  visible: boolean;
  currentNode: string;
  onCancel: () => void;
  onSave: (newNode: string) => Promise<boolean>;
}

export const CustomNodeModal: React.FC<CustomNodeModalProps> = ({
  visible,
  currentNode,
  onCancel,
  onSave,
}) => {
  const [nodeUrl, setNodeUrl] = useState(currentNode);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = async (): Promise<boolean> => {
    setIsTesting(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${nodeUrl}getheight`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        Alert.alert('Success', `Connection successful! Current height: ${data.height || 'Unknown'}`);
        return true;
      } else {
        Alert.alert('Error', 'Failed to connect to node. Please check the URL.');
        return false;
      }
    } catch (error) {
      Alert.alert('Error', `Connection failed: ${error.message}`);
      return false;
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!nodeUrl.trim()) {
      // Empty field means reset to default (clear custom node)
      const success = await onSave('');
      if (success) {
        Alert.alert('Success', 'Reset to default node selection!');
      }
      return;
    }

    // Ensure URL has proper format
    let formattedUrl = nodeUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    if (!formattedUrl.endsWith('/')) {
      formattedUrl += '/';
    }

    // Test connection before saving
    const isConnected = await handleTestConnection();
    if (isConnected) {
      const success = await onSave(formattedUrl);
      if (success) {
        Alert.alert('Success', 'Custom node saved successfully!');
      }
    }
  };

  const handleCancel = () => {
    setNodeUrl(currentNode); // Reset to original value
    onCancel();
  };

  const handleResetToDefault = async () => {
    setNodeUrl(''); // Clear the field
    // Immediately clear the custom node from storage
    try {
      const success = await onSave('');
      if (success) {
        Alert.alert('Success', 'Reset to default node selection!');
        onCancel(); // Close the modal
      }
    } catch (error) {
      console.error('Error resetting to default:', error);
      Alert.alert('Error', 'Failed to reset to default');
    }
  };

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
            <Text style={styles.title}>Custom Remote Node</Text>
            <Text style={styles.subtitle}>
              Configure your preferred blockchain node for enhanced privacy and control
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Node URL</Text>
              <TextInput
                style={styles.textInput}
                value={nodeUrl}
                onChangeText={setNodeUrl}
                placeholder="Enter your node URL (e.g., https://your-node.com/)"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
              <Text style={styles.inputHint}>
                Make sure your node supports the required API endpoints
              </Text>
            </View>

            {/* Test Connection - Full width, grey background */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.testButton, styles.fullWidthButton]}
                onPress={handleTestConnection}
                disabled={isTesting || !nodeUrl.trim()}
              >
                <Text style={styles.testButtonText}>
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Bottom row: Cancel | Reset to Default | Save */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={isTesting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.resetButton]}
                onPress={handleResetToDefault}
                disabled={isTesting}
              >
                <Text style={styles.resetButtonText}>Reset to Default</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
                disabled={isTesting || !nodeUrl.trim()}
              >
                <Text style={styles.saveButtonText}>Save</Text>
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
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    minHeight: 80,
  },
  inputHint: {
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
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  fullWidthButton: {
    flex: 1,
    marginHorizontal: 0,
  },
  resetButton: {
    backgroundColor: '#FFA500',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  testButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  resetButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  testButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
