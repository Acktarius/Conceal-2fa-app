import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';

import { useTheme } from '../contexts/ThemeContext';
import { SharedKey } from '../model/Transaction';
import { StorageService } from '../services/StorageService';
import { IconService, IconInfo } from '../services/IconService';

interface ServiceCardProps {
  sharedKey: SharedKey;
  isSelected: boolean;
  walletBalance: number;

  onCopy: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onBroadcast: () => void;
  onSaveToBlockchain: () => void;
}

// Helper component to render the appropriate icon based on family
const ServiceIcon: React.FC<{ iconInfo: IconInfo; size: number; color: string }> = ({ iconInfo, size, color }) => {
  switch (iconInfo.family) {
    case 'Ionicons':
      return <Ionicons name={iconInfo.name as any} size={size} color={color} />;
    case 'MaterialIcons':
      return <MaterialIcons name={iconInfo.name as any} size={size} color={color} />;
    case 'FontAwesome':
      return <FontAwesome name={iconInfo.name as any} size={size} color={color} />;
    default:
      return <Ionicons name="shield" size={size} color={color} />;
  }
};

export default function ServiceCard({ 
  sharedKey, 
  isSelected, 
  walletBalance, 

  onCopy, 
  onDelete, 
  onSelect, 
  onBroadcast, 
  onSaveToBlockchain 
}: ServiceCardProps) {
  const { theme } = useTheme();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [futureCode, setFutureCode] = React.useState<string>('');
  const [showFutureCode, setShowFutureCode] = React.useState(false);
  const flipAnim = React.useRef(new Animated.Value(0)).current;
  const actionsAnim = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    Animated.timing(actionsAnim, {
      toValue: isSelected ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isSelected]);

  // Future code display logic
  React.useEffect(() => {
    const checkFutureCodeDisplay = async () => {
      try {
        const settings = await StorageService.getSettings();
        const futureDisplaySetting = settings.futureCodeDisplay || 'off';
        
        if (futureDisplaySetting === 'off') {
          setShowFutureCode(false);
          return;
        }
        
        // Generate future code (next 30-second period)
        const futureTime = Math.floor(Date.now() / 30000) + 1;
        const futureCodeGenerated = await generateFutureCode(sharedKey.secret, futureTime);
        setFutureCode(futureCodeGenerated);
        
        // Determine when to show future code
        const timeRemaining = sharedKey.timeRemaining;
        let shouldShow = false;
        
        switch (futureDisplaySetting) {
          case 'on':
            shouldShow = true;
            break;
          case '5s':
            shouldShow = timeRemaining <= 5;
            break;
          case '10s':
            shouldShow = timeRemaining <= 10;
            break;
          default:
            shouldShow = false;
        }
        
        setShowFutureCode(shouldShow);
      } catch (error) {
        console.error('Error checking future code display:', error);
        setShowFutureCode(false);
      }
    };
    
    checkFutureCodeDisplay();
  }, [sharedKey.timeRemaining, sharedKey.secret]);

  // Generate future TOTP code
  const generateFutureCode = async (secret: string, timeStep: number): Promise<string> => {
    // This is a simplified version - in reality you'd use the same TOTP algorithm
    // with the future time step. For now, we'll generate a placeholder.
    try {
      // Import TOTPService dynamically to avoid circular dependencies
      const { TOTPService } = await import('../services/TOTPService');
      return await TOTPService.generateTOTPForTimeStep(secret, timeStep);
    } catch (error) {
      console.error('Error generating future code:', error);
      return '000000'; // Fallback
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
    Animated.timing(flipAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleCancelDelete = () => {
    Animated.timing(flipAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowDeleteConfirm(false);
    });
  };

  const handleConfirmDelete = () => {
    Animated.timing(flipAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowDeleteConfirm(false);
      onDelete();
    });
  };

  const progressPercentage = (sharedKey.timeRemaining / 30) * 100;
  
  // Calculate opacity based on time remaining (100% to 70%)
  const codeOpacity = 0.6 + (sharedKey.timeRemaining / 30) * 0.4;
  
  const minTransactionAmount = 0.011;
  const canUseBlockchainFeatures = walletBalance >= minTransactionAmount;

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  return (
    <View 
      className={`w-full rounded-xl mb-3 shadow-lg ${isSelected ? 'min-h-[160px]' : 'min-h-[130px]'}`}
      style={[
        { backgroundColor: theme.colors.card },
        isSelected && { borderWidth: 2, borderColor: theme.colors.primary }
      ]}
    >
      {/* Front of card */}
      <Animated.View
        className="absolute w-full h-full rounded-2xl"
        style={[
          { transform: [{ rotateY: frontInterpolate }] },
          showDeleteConfirm && { opacity: 0, pointerEvents: 'none' }
        ]}
      >
        <TouchableOpacity 
          className="h-full p-3"
          onPress={onSelect}
          activeOpacity={0.9}
        >
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
              <Text 
                className="text-lg font-semibold mb-1 min-h-[22px] font-poppins-medium" 
                style={{ color: theme.colors.text }} 
                numberOfLines={1}
              >
                {sharedKey.name}
              </Text>
              <View className="flex-row items-center">
                <Text 
                  className="text-sm min-h-[18px] font-poppins" 
                  style={{ color: theme.colors.textSecondary }}
                >
                  {sharedKey.issuer}
                </Text>
                {sharedKey.isLocalOnly() && (
                  <View 
                    className="rounded-md px-1.5 py-0.5 ml-2"
                    style={{ backgroundColor: theme.colors.warning + '20' }}
                  >
                    <Text 
                      className="text-xs font-semibold font-poppins-medium" 
                      style={{ color: theme.colors.warning }}
                    >
                      Local
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              className="p-1"
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center mb-3">
            {/* Service Icon */}
            <View className="w-8 h-8 items-center justify-center mr-3">
              <ServiceIcon 
                iconInfo={IconService.getServiceIcon(sharedKey.name)}
                size={20} 
                color={theme.colors.textSecondary} 
              />
            </View>
            
            {/* 2FA Code - No box, tap to copy */}
            <TouchableOpacity
              className="flex-row items-center flex-1 mr-3"
              onPress={onCopy}
              activeOpacity={0.8}
            >
              <Text 
                className="text-4xl font-bold font-mono tracking-wider" 
                style={{ color: '#3B82F6', opacity: codeOpacity }}
              >
                {sharedKey.code.slice(0, 3)} {sharedKey.code.slice(3)}
              </Text>
              
              {/* Future Code Display */}
              {showFutureCode && (
                <Text 
                  className="text-lg font-mono italic ml-4" 
                  style={{ color: theme.colors.textSecondary, opacity: 0.7 }}
                >
                  {futureCode.slice(0, 3)} {futureCode.slice(3)}
                </Text>
              )}
            </TouchableOpacity>
            
            {/* Circular Countdown Timer */}
            <View className="w-12 h-12 items-center justify-center">
              <View 
                className="absolute w-12 h-12 rounded-full border-2"
                style={{ borderColor: theme.colors.border }}
              />
              <View
                className="absolute w-12 h-12 rounded-full border-2"
                style={{
                  borderColor: '#3B82F6',
                  borderTopColor: 'transparent',
                  transform: [{ rotate: `${(sharedKey.timeRemaining / 30) * 360}deg` }],
                  opacity: codeOpacity,
                }}
              />
              <Text 
                className="text-xs font-bold font-poppins-medium" 
                style={{ color: theme.colors.textSecondary }}
              >
                {sharedKey.timeRemaining}
              </Text>
            </View>
          </View>

          {isSelected && (
            <Animated.View 
              className="flex-row mt-0.5 px-1"
              style={{
                opacity: actionsAnim,
                transform: [
                  {
                    translateY: actionsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              }}
            >
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center rounded-lg px-1.5 py-2 mx-0.5"
                style={{ 
                  backgroundColor: canUseBlockchainFeatures ? theme.colors.primaryLight : theme.colors.border,
                  opacity: canUseBlockchainFeatures ? 1 : 0.5 
                }}
                onPress={canUseBlockchainFeatures ? onBroadcast : undefined}
                disabled={!canUseBlockchainFeatures}
                activeOpacity={canUseBlockchainFeatures ? 0.7 : 1}
              >
                <Ionicons 
                  name="radio-outline" 
                  size={16} 
                  color={canUseBlockchainFeatures ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <Text 
                  className="text-xs font-semibold ml-1 text-center font-poppins-medium" 
                  style={{ color: canUseBlockchainFeatures ? theme.colors.primary : theme.colors.textSecondary }}
                >
                  Broadcast
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center rounded-lg px-1.5 py-2 mx-0.5"
                style={{ 
                  backgroundColor: canUseBlockchainFeatures ? theme.colors.primaryLight : theme.colors.border,
                  opacity: canUseBlockchainFeatures ? 1 : 0.5,
                }}
                onPress={canUseBlockchainFeatures ? onSaveToBlockchain : undefined}
                disabled={!canUseBlockchainFeatures}
                activeOpacity={canUseBlockchainFeatures ? 0.7 : 1}
              >
                <Ionicons 
                  name="link-outline" 
                  size={16} 
                  color={canUseBlockchainFeatures ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <Text 
                  className="text-xs font-semibold ml-1 text-center font-poppins-medium" 
                  style={{ color: canUseBlockchainFeatures ? theme.colors.primary : theme.colors.textSecondary }}
                >
                  Save on Blockchain
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Back of card - Delete confirmation */}
      <Animated.View
        className="absolute w-full h-full rounded-2xl"
        style={[
          { transform: [{ rotateY: backInterpolate }] },
          !showDeleteConfirm && { opacity: 0, pointerEvents: 'none' }
        ]}
      >
        <View className="flex-1 items-center justify-center p-5">
          <Ionicons name="warning-outline" size={48} color={theme.colors.warning} />
          <Text 
            className="text-lg font-semibold mt-4 mb-2 text-center font-poppins-medium" 
            style={{ color: theme.colors.text }}
          >
            Are you sure you want to delete?
          </Text>
          <Text 
            className="text-sm text-center leading-5 mb-6 font-poppins" 
            style={{ color: theme.colors.textSecondary }}
          >
            {sharedKey.isLocalOnly() 
              ? "This will permanently delete this service from your device."
              : "This will delete the service locally and revoke it from the blockchain."
            }
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="rounded-xl px-6 py-3"
              style={{ backgroundColor: theme.colors.border }}
              onPress={handleCancelDelete}
              activeOpacity={0.8}
            >
              <Text 
                className="text-base font-semibold font-poppins-medium" 
                style={{ color: theme.colors.text }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="rounded-xl px-6 py-3"
              style={{ backgroundColor: theme.colors.error }}
              onPress={handleConfirmDelete}
              activeOpacity={0.8}
            >
              <Text className="text-base font-semibold text-white font-poppins-medium">
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}