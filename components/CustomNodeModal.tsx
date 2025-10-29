import type React from 'react';
import { useState } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { config } from '../config';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

export interface CustomNodeModalProps {
  visible: boolean;
  currentNode: string;
  onCancel: () => void;
  onSave: (newNode: string) => Promise<boolean>;
}

export const CustomNodeModal: React.FC<CustomNodeModalProps> = ({ visible, currentNode, onCancel, onSave }) => {
  const { theme } = useTheme();
  const [nodeUrl, setNodeUrl] = useState(currentNode);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = async (): Promise<boolean> => {
    setIsTesting(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${nodeUrl}getheight`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Success', `Connection successful! Current height: ${data.height || 'Unknown'}`);
        return true;
      }
      Alert.alert('Error', 'Failed to connect to node. Please check the URL.');
      return false;
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView className="flex-1 justify-center items-center" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-1 w-full justify-center items-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <View
            className="rounded-2xl p-6 mx-5 shadow-lg"
            style={{
              backgroundColor: '#FFFFFF', // Constant white background for better contrast
              width: width * 0.9,
              maxWidth: 500,
            }}
          >
            <Text className="text-2xl font-bold text-center mb-2 font-poppins-medium" style={{ color: '#1A1A1A' }}>
              Custom Remote Node
            </Text>
            <Text className="text-base text-center mb-6 leading-6 font-poppins" style={{ color: '#666666' }}>
              Configure your preferred blockchain node for enhanced privacy and control
            </Text>

            <View className="mb-5">
              <Text className="text-base font-semibold mb-2 font-poppins-medium" style={{ color: '#333333' }}>
                Node URL
              </Text>
              <TextInput
                className="border rounded-lg p-3 text-base min-h-20"
                style={{
                  backgroundColor: '#F8F9FA',
                  color: '#1A1A1A',
                  borderColor: '#DEE2E6',
                }}
                value={nodeUrl}
                onChangeText={setNodeUrl}
                placeholder="Enter your node URL (e.g., https://your-node.com/)"
                placeholderTextColor="#999999"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
              <Text className="text-xs mt-1 italic font-poppins" style={{ color: '#999999' }}>
                Make sure your node supports the required API endpoints
              </Text>
            </View>

            {/* Test Connection - Full width */}
            <View className="mb-6">
              <TouchableOpacity
                className="flex-1 rounded-lg p-3 border items-center justify-center"
                style={{
                  backgroundColor: '#F8F9FA',
                  borderColor: '#DEE2E6',
                  opacity: isTesting || !nodeUrl.trim() ? 0.5 : 1,
                  minHeight: 48,
                }}
                onPress={handleTestConnection}
                disabled={isTesting || !nodeUrl.trim()}
                activeOpacity={0.8}
              >
                <Text className="text-base font-semibold text-center font-poppins-medium" style={{ color: '#333333' }}>
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bottom row: Cancel | Reset to Default | Save */}
            <View className="flex-row mt-10 justify-between items-center">
              <TouchableOpacity
                className="flex-1 rounded-lg p-3 border mx-1 items-center justify-center"
                style={{
                  backgroundColor: '#F8F9FA',
                  borderColor: '#DEE2E6',
                  opacity: isTesting ? 0.5 : 1,
                  minHeight: 48,
                }}
                onPress={handleCancel}
                disabled={isTesting}
                activeOpacity={0.8}
              >
                <Text className="text-base font-semibold text-center font-poppins-medium" style={{ color: '#333333' }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 rounded-lg p-3 mx-1 items-center justify-center"
                style={{
                  backgroundColor: '#FFA500',
                  opacity: isTesting ? 0.5 : 1,
                  minHeight: 48,
                  maxHeight: 54,
                }}
                onPress={handleResetToDefault}
                disabled={isTesting}
                activeOpacity={0.8}
              >
                <Text className="text-sm font-semibold text-center text-white font-poppins-medium">Reset to Default</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 rounded-lg p-3 mx-1 items-center justify-center"
                style={{
                  backgroundColor: '#007AFF',
                  opacity: isTesting || !nodeUrl.trim() ? 0.5 : 1,
                  minHeight: 48,
                }}
                onPress={handleSave}
                disabled={isTesting || !nodeUrl.trim()}
                activeOpacity={0.8}
              >
                <Text className="text-base font-semibold text-center text-white font-poppins-medium">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
