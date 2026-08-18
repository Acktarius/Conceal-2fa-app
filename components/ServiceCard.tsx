import { FontAwesome, Ionicons, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Animated, Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '../contexts/ThemeContext';
import type { SharedKey } from '../model/Transaction';
import { dependencyContainer } from '../services/DependencyContainer';
import { type IconInfo, IconService } from '../services/IconService';
import { StorageService } from '../services/StorageService';

interface ServiceCardProps {
  sharedKey: SharedKey;
  isSelected: boolean;
  walletBalance: number;
  blockchainSyncEnabled?: boolean;
  futureDisplaySetting?: string;

  onCopy: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onBroadcast: (futureCode?: string) => void;
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

const ServiceCard = React.forwardRef<any, ServiceCardProps>(
  (
    {
      sharedKey,
      isSelected,
      walletBalance,
      blockchainSyncEnabled = false,
      futureDisplaySetting = 'off',

      onCopy,
      onDelete,
      onSelect,
      onBroadcast,
      onSaveToBlockchain,
    },
    ref
  ) => {
    const { theme } = useTheme();
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [cachedFutureCode, setCachedFutureCode] = React.useState<string>('');
    const [isPulsing, setIsPulsing] = React.useState(false);
    const flipAnim = React.useRef(new Animated.Value(0)).current;
    const actionsAnim = React.useRef(new Animated.Value(0)).current;
    const pulseAnim = React.useRef(new Animated.Value(1)).current;

    // Calculate adaptive font sizes for 2FA code display based on screen width
    const screenWidth = Dimensions.get('window').width;
    const codeFontSize = screenWidth < 380 ? 32 : screenWidth < 420 ? 36 : 40;
    const futureCodeFontSize = screenWidth < 380 ? 14 : screenWidth < 420 ? 16 : 18;

    React.useEffect(() => {
      Animated.timing(actionsAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, [isSelected]);

    // Cache the futureCode when it becomes available and complete
    React.useEffect(() => {
      if (sharedKey.futureCode && sharedKey.futureCode.length >= 6) {
        setCachedFutureCode(sharedKey.futureCode);
      }
    }, [sharedKey.futureCode]);

    // Derived directly from current props — no state lag, no one-frame flash at period boundary
    const showFutureCode =
      !!sharedKey.futureCode &&
      (futureDisplaySetting === 'on' ||
        (futureDisplaySetting === '5s' && sharedKey.timeRemaining <= 5) ||
        (futureDisplaySetting === '10s' && sharedKey.timeRemaining <= 10));

    // Trigger pulsing animation
    const triggerPulse = () => {
      'worklet';
      setIsPulsing(true);
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsPulsing(false);
      });
    };

    // Expose triggerPulse function to parent component
    React.useImperativeHandle(ref, () => ({
      triggerPulse: () => {
        scheduleOnRN(triggerPulse);
      },
    }));

    const handleDelete = () => {
      setShowDeleteConfirm(true);
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    };

    const handleUnknownSourceWarning = () => {
      Alert.alert(
        'Unknown Source Warning',
        'This service card comes from an unknown source. Do you want to trust it or keep it as unknown?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              // Keep unknownSource flag as true, do nothing
            },
          },
          {
            text: 'Trust',
            style: 'default',
            onPress: async () => {
              try {
                // Update the shared key to mark as trusted
                const sharedKeys = await StorageService.getSharedKeys();
                const updatedSharedKeys = sharedKeys.map((sk) => {
                  if (sk.hash === sharedKey.hash || (sk.name === sharedKey.name && sk.secret === sharedKey.secret)) {
                    sk.unknownSource = false;
                  }
                  return sk;
                });
                await StorageService.saveSharedKeys(updatedSharedKeys);

                // Trigger a refresh by calling wallet operations through dependency container
                const walletOperations = dependencyContainer.getWalletOperations();
                walletOperations.triggerSharedKeysRefresh();

                Alert.alert('Success', 'Service is now trusted');
              } catch (error) {
                console.error('Error trusting unknown source:', error);
                Alert.alert('Error', 'Failed to trust the service. Please try again.');
              }
            },
          },
        ]
      );
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
      <Animated.View
        className={`w-full rounded-xl mb-3 shadow-lg ${isSelected ? 'min-h-[160px]' : 'min-h-[130px]'}`}
        style={[
          { backgroundColor: theme.colors.card },
          isSelected && { borderWidth: 2, borderColor: theme.colors.primary },
          isPulsing && {
            borderWidth: 3,
            borderColor: theme.colors.pulseColor,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {/* Front of card */}
        <Animated.View
          className="absolute w-full h-full rounded-2xl"
          style={[{ transform: [{ rotateY: frontInterpolate }] }, showDeleteConfirm && { opacity: 0, pointerEvents: 'none' }]}
        >
          <TouchableOpacity className="h-full p-3" onPress={onSelect} activeOpacity={0.9}>
            <View className="flex-row justify-between items-start mb-3">
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Text
                    className="text-lg font-semibold min-h-[22px] font-poppins-medium"
                    style={{ color: theme.colors.text }}
                    numberOfLines={1}
                  >
                    {sharedKey.name}
                  </Text>
                  {sharedKey.algorithm !== 'SHA1' && (
                    <View className="rounded-md px-1.5 py-0.5 ml-2" style={{ backgroundColor: theme.colors.status + '20' }}>
                      <Text className="text-xs font-semibold font-poppins-medium" style={{ color: theme.colors.status }}>
                        {sharedKey.algorithm}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center">
                  <Text className="text-sm min-h-[18px] font-poppins" style={{ color: theme.colors.textSecondary }}>
                    {sharedKey.issuer}
                  </Text>
                  {sharedKey.isLocal ? (
                    <View className="rounded-md px-1.5 py-0.5 ml-2" style={{ backgroundColor: theme.colors.status + '20' }}>
                      <Text className="text-xs font-semibold font-poppins-medium" style={{ color: theme.colors.status }}>
                        Local
                      </Text>
                    </View>
                  ) : (
                    <View
                      className="rounded-md px-1.5 py-0.5 ml-2 flex-row items-center"
                      style={{ backgroundColor: theme.colors.status + '20' }}
                    >
                      <Ionicons name="link" size={12} color={theme.colors.status} />
                    </View>
                  )}
                </View>
              </View>
              <View className="flex-row items-center">
                {/* Warning icon for unknown source */}
                {sharedKey.unknownSource && (
                  <TouchableOpacity className="p-1 mr-1" onPress={handleUnknownSourceWarning} activeOpacity={0.7}>
                    <Ionicons name="warning" size={20} color="#F59E0B" />
                  </TouchableOpacity>
                )}

                {/* Delete button */}
                <TouchableOpacity className="p-1" onPress={handleDelete} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={20} color={theme.colors.warning} />
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row items-center mb-3">
              {/* Service Icon */}
              <View className="w-8 h-8 items-center justify-center mr-3">
                <ServiceIcon
                  iconInfo={IconService.getServiceIcon(sharedKey.name, sharedKey.issuer)}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </View>

              {/* 2FA Code - No box, tap to copy */}
              <TouchableOpacity className="flex-row items-center flex-1 mr-1" onPress={onCopy} activeOpacity={0.8}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    className="font-bold font-mono"
                    style={{ color: '#3B82F6', opacity: codeOpacity, fontSize: codeFontSize, letterSpacing: 1 }}
                  >
                    {sharedKey.code.slice(0, 3)}
                  </Text>
                  <Text
                    className="font-bold font-mono"
                    style={{ color: '#3B82F6', opacity: codeOpacity, fontSize: codeFontSize, letterSpacing: 1, marginHorizontal: 1 }}
                  >
                    {sharedKey.code.slice(3)}
                  </Text>
                </View>

                {/* Future Code Display */}
                {showFutureCode && cachedFutureCode && cachedFutureCode.length >= 6 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 2 }}>
                    <Text
                      className="font-mono italic"
                      style={{ color: theme.colors.textSecondary, opacity: 0.7, fontSize: futureCodeFontSize }}
                    >
                      {cachedFutureCode.slice(0, 3)}
                    </Text>
                    <Text
                      className="font-mono italic"
                      style={{ color: theme.colors.textSecondary, opacity: 0.7, fontSize: futureCodeFontSize, marginHorizontal: 1 }}
                    >
                      {cachedFutureCode.slice(3)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Circular Countdown Timer */}
              <View className="w-12 h-12 items-center justify-center">
                <View className="absolute w-12 h-12 rounded-full border-2" style={{ borderColor: theme.colors.border }} />
                <View
                  className="absolute w-12 h-12 rounded-full border-2"
                  style={{
                    borderColor: '#3B82F6',
                    borderTopColor: 'transparent',
                    transform: [{ rotate: `${(sharedKey.timeRemaining / 30) * 360}deg` }],
                    opacity: codeOpacity,
                  }}
                />
                <Text className="text-xs font-bold font-poppins-medium" style={{ color: theme.colors.textSecondary }}>
                  {sharedKey.timeRemaining}
                </Text>
              </View>
            </View>

            {isSelected && (
              <Animated.View
                className="flex-row mt-0.3 px-1"
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
                  className="flex-1 flex-row items-center justify-center rounded-lg px-1.5 py-2 mx-0.5 max-w-[45%]"
                  style={{
                    backgroundColor: canUseBlockchainFeatures ? theme.colors.primaryLight : theme.colors.border,
                    opacity: canUseBlockchainFeatures ? 1 : 0.5,
                  }}
                  onPress={
                    canUseBlockchainFeatures
                      ? () => {
                          onBroadcast(sharedKey.futureCode || undefined);
                          onSelect(); // Retract the card after broadcasting
                        }
                      : undefined
                  }
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

                {/* Only show Save on Blockchain button if blockchain sync is disabled AND sharedKey is local */}
                {!blockchainSyncEnabled && sharedKey.isLocal && (
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center rounded-lg px-1.5 py-2 mx-0.5"
                    style={{
                      backgroundColor: canUseBlockchainFeatures ? theme.colors.primaryLight : theme.colors.border,
                      opacity: canUseBlockchainFeatures ? 1 : 0.5,
                    }}
                    onPress={
                      canUseBlockchainFeatures
                        ? () => {
                            onSaveToBlockchain();
                            onSelect(); // Retract the card after saving to blockchain
                          }
                        : undefined
                    }
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
                )}
              </Animated.View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Back of card - Delete confirmation */}
        <Animated.View
          className="absolute w-full h-full rounded-2xl"
          style={[{ transform: [{ rotateY: backInterpolate }] }, !showDeleteConfirm && { opacity: 0, pointerEvents: 'none' }]}
        >
          <View className="flex-1 items-center justify-center p-5">
            <View className="flex-row items-center mb-2">
              <Ionicons name="warning-outline" size={24} color={theme.colors.warning} />
              <Text className="text-lg font-semibold ml-2 text-center font-poppins-medium" style={{ color: theme.colors.text }}>
                Are you sure you want to delete?
              </Text>
            </View>
            <Text className="text-sm text-center leading-5 mb-3 font-poppins" style={{ color: theme.colors.textSecondary }}>
              {sharedKey.isLocal
                ? 'This will permanently delete this service from your device.'
                : 'The key will be hidden and can be marked as deleted on blockchain in Settings \u203a Storage.'}
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="rounded-xl px-6 py-3"
                style={{ backgroundColor: theme.colors.border }}
                onPress={handleCancelDelete}
                activeOpacity={0.8}
              >
                <Text className="text-base font-semibold font-poppins-medium" style={{ color: theme.colors.text }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-xl px-6 py-3"
                style={{ backgroundColor: theme.colors.error }}
                onPress={handleConfirmDelete}
                activeOpacity={0.8}
              >
                <Text className="text-base font-semibold text-white font-poppins-medium">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    );
  }
);

export default ServiceCard;
