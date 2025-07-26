import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../contexts/ThemeContext';
import { SharedKey } from '../models/Transaction';

interface ServiceCardProps {
  sharedKey: SharedKey;
  isSelected: boolean;
  walletBalance: number;
  isWalletSynced: boolean;
  onCopy: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onBroadcast: () => void;
  onSaveToBlockchain: () => void;
}

export default function ServiceCard({ 
  sharedKey, 
  isSelected, 
  walletBalance, 
  isWalletSynced, 
  onCopy, 
  onDelete, 
  onSelect, 
  onBroadcast, 
  onSaveToBlockchain 
}: ServiceCardProps) {
  const { theme } = useTheme();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const flipAnim = React.useRef(new Animated.Value(0)).current;
  
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
  const isExpiringSoon = sharedKey.timeRemaining <= 10;
  const minTransactionAmount = 0.011;
  const canUseBlockchainFeatures = isWalletSynced && walletBalance >= minTransactionAmount;
  const styles = createStyles(theme);

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
      style={[
        styles.container, 
        { backgroundColor: theme.colors.card },
        isSelected && { borderWidth: 2, borderColor: theme.colors.primary }
      ]}
    >
      {/* Front of card */}
      <Animated.View
        style={[
          styles.cardFace,
          { transform: [{ rotateY: frontInterpolate }] },
          showDeleteConfirm && styles.hiddenFace
        ]}
      >
        <TouchableOpacity 
          style={styles.cardContent}
          onPress={onSelect}
          activeOpacity={0.9}
        >
          <View style={styles.header}>
            <View style={styles.serviceInfo}>
              <Text style={[styles.serviceName, { color: theme.colors.text }]}>{sharedKey.name}</Text>
              <View style={styles.issuerRow}>
                <Text style={[styles.issuer, { color: theme.colors.textSecondary }]}>{sharedKey.issuer}</Text>
                {sharedKey.isLocalOnly() && (
                  <View style={[styles.localBadge, { backgroundColor: theme.colors.warning + '20' }]}>
                    <Text style={[styles.localBadgeText, { color: theme.colors.warning }]}>Local</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.codeContainer, { backgroundColor: theme.colors.background }]}
            onPress={onCopy}
            activeOpacity={0.8}
          >
            <Text style={[styles.code, { color: theme.colors.text }, isExpiringSoon && { color: theme.colors.error }]}>
              {sharedKey.code.slice(0, 3)} {sharedKey.code.slice(3)}
            </Text>
            <View style={styles.copyIcon}>
              <Ionicons name="copy-outline" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.footer}>
            <View style={styles.progressContainer}>
              <View style={[styles.progressBackground, { backgroundColor: theme.colors.border }]}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${progressPercentage}%`,
                      backgroundColor: isExpiringSoon ? theme.colors.error : theme.colors.success,
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={[styles.timeRemaining, { color: theme.colors.textSecondary }, isExpiringSoon && { color: theme.colors.error }]}>
              {sharedKey.timeRemaining}s
            </Text>
          </View>

          {isSelected && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.actionButton, 
                  { 
                    backgroundColor: canUseBlockchainFeatures ? theme.colors.primaryLight : theme.colors.border,
                    opacity: canUseBlockchainFeatures ? 1 : 0.5 
                  }
                ]}
                onPress={canUseBlockchainFeatures ? onBroadcast : undefined}
                disabled={!canUseBlockchainFeatures}
                activeOpacity={canUseBlockchainFeatures ? 0.7 : 1}
              >
                <Ionicons 
                  name="radio-outline" 
                  size={16} 
                  color={canUseBlockchainFeatures ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.actionText, 
                  { color: canUseBlockchainFeatures ? theme.colors.primary : theme.colors.textSecondary }
                ]}>
                  Broadcast to myself
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionButton, 
                  { 
                    backgroundColor: canUseBlockchainFeatures ? theme.colors.primaryLight : theme.colors.border,
                    opacity: canUseBlockchainFeatures ? 1 : 0.5,
                  }
                ]}
                onPress={canUseBlockchainFeatures ? onSaveToBlockchain : undefined}
                disabled={!canUseBlockchainFeatures}
                activeOpacity={canUseBlockchainFeatures ? 0.7 : 1}
              >
                <Ionicons 
                  name="link-outline" 
                  size={16} 
                  color={canUseBlockchainFeatures ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.actionText, 
                  { color: canUseBlockchainFeatures ? theme.colors.primary : theme.colors.textSecondary }
                ]}>
                  Save on Blockchain
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Back of card - Delete confirmation */}
      <Animated.View
        style={[
          styles.cardFace,
          styles.cardBack,
          { transform: [{ rotateY: backInterpolate }] },
          !showDeleteConfirm && styles.hiddenFace
        ]}
      >
        <View style={styles.deleteConfirmContainer}>
          <Ionicons name="warning-outline" size={48} color={theme.colors.warning} />
          <Text style={[styles.deleteTitle, { color: theme.colors.text }]}>
            Are you sure you want to delete?
          </Text>
          <Text style={[styles.deleteMessage, { color: theme.colors.textSecondary }]}>
            {sharedKey.isLocalOnly() 
              ? "This will permanently delete this service from your device."
              : "This will delete the service locally and revoke it from the blockchain."
            }
          </Text>
          <View style={styles.deleteActions}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.colors.border }]}
              onPress={handleCancelDelete}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: theme.colors.error }]}
              onPress={handleConfirmDelete}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    ...(Platform.OS === 'web' && {
      transition: 'all 0.2s ease-in-out',
    }),
    elevation: 4,
    position: 'relative',
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    borderRadius: 16,
  },
  cardBack: {
    backgroundColor: 'transparent',
  },
  hiddenFace: {
    opacity: 0,
    pointerEvents: 'none',
  },
  cardContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  issuer: {
    fontSize: 14,
  },
  deleteButton: {
    padding: 4,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  code: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  copyIcon: {
    opacity: 0.6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
    marginRight: 12,
  },
  progressBackground: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  timeRemaining: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },
  issuerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  localBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  localBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  queueBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  queueBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
    textAlign: 'center',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteConfirmContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});