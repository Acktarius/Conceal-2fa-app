import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../contexts/ThemeContext';

interface Service {
  id: string;
  name: string;
  issuer: string;
  code: string;
  timeRemaining: number;
  isLocalOnly: boolean;
  blockchainTxHash?: string;
  inQueue?: boolean;
  revokeInQueue?: boolean;
}

interface ServiceCardProps {
  service: Service;
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
  service, 
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
  
  const handleDelete = () => {
    const deleteMessage = service.revokeInQueue 
      ? `${service.name} is queued for revocation. Delete anyway?`
      : `Are you sure you want to remove ${service.name}?`;
      
    Alert.alert(
      'Delete Service',
      deleteMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  const progressPercentage = (service.timeRemaining / 30) * 100;
  const isExpiringSoon = service.timeRemaining <= 10;
  const minTransactionAmount = 0.011;
  const canUseBlockchainFeatures = isWalletSynced && walletBalance >= minTransactionAmount;
  const styles = createStyles(theme);

  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        { backgroundColor: theme.colors.card },
        isSelected && { borderWidth: 2, borderColor: theme.colors.primary }
      ]}
      onPress={onSelect}
      activeOpacity={0.9}
    >
      <View style={styles.header}>
        <View style={styles.serviceInfo}>
          <Text style={[styles.serviceName, { color: theme.colors.text }]}>{service.name}</Text>
          <View style={styles.issuerRow}>
            <Text style={[styles.issuer, { color: theme.colors.textSecondary }]}>{service.issuer}</Text>
            {service.isLocalOnly ? (
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
          {service.code.slice(0, 3)} {service.code.slice(3)}
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
          {service.timeRemaining}s
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
                marginLeft: 8
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
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    ...(Platform.OS === 'web' && {
      transition: 'all 0.2s ease-in-out',
    }),
    elevation: 4,
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
    justifyContent: 'center',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
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
});