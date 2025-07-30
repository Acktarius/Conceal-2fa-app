import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SharedKey } from '../models/Transaction';
import { useTheme } from '../contexts/ThemeContext';

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
  onSaveToBlockchain,
}: ServiceCardProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const canSaveToBlockchain = walletBalance >= 0.0001 && isWalletSynced;
  const isLocalOnly = sharedKey.isLocalOnly();

  const getProgressColor = () => {
    if (sharedKey.timeRemaining <= 5) return theme.colors.error;
    if (sharedKey.timeRemaining <= 10) return theme.colors.warning;
    return theme.colors.success;
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: theme.colors.card },
        isSelected && { borderColor: theme.colors.primary, borderWidth: 2 }
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.serviceInfo}>
          <Text style={[styles.serviceName, { color: theme.colors.text }]}>
            {sharedKey.name}
          </Text>
          <Text style={[styles.issuer, { color: theme.colors.textSecondary }]}>
            {sharedKey.issuer}
          </Text>
        </View>
        
        <View style={styles.statusContainer}>
          {isLocalOnly ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.colors.warning + '20' }]}>
              <Ionicons name="phone-portrait-outline" size={12} color={theme.colors.warning} />
              <Text style={[styles.statusText, { color: theme.colors.warning }]}>Local</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: theme.colors.success + '20' }]}>
              <Ionicons name="cloud-outline" size={12} color={theme.colors.success} />
              <Text style={[styles.statusText, { color: theme.colors.success }]}>Synced</Text>
            </View>
          )}
        </View>
      </View>

      {/* TOTP Code */}
      <View style={styles.codeContainer}>
        <TouchableOpacity
          style={[styles.codeButton, { backgroundColor: theme.colors.primaryLight }]}
          onPress={onCopy}
          activeOpacity={0.7}
        >
          <Text style={[styles.code, { color: theme.colors.primary }]}>
            {sharedKey.code}
          </Text>
          <Ionicons name="copy-outline" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
        
        <View style={styles.timerContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: getProgressColor(),
                  width: `${(sharedKey.timeRemaining / 30) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.timer, { color: getProgressColor() }]}>
            {sharedKey.timeRemaining}s
          </Text>
        </View>
      </View>

      {/* Actions (shown when selected) */}
      {isSelected && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.accent + '20' }]}
            onPress={onBroadcast}
            activeOpacity={0.7}
          >
            <Ionicons name="radio-outline" size={16} color={theme.colors.accent} />
            <Text style={[styles.actionText, { color: theme.colors.accent }]}>Broadcast</Text>
          </TouchableOpacity>

          {isLocalOnly && canSaveToBlockchain && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.success + '20' }]}
              onPress={onSaveToBlockchain}
              activeOpacity={0.7}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={theme.colors.success} />
              <Text style={[styles.actionText, { color: theme.colors.success }]}>Save</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.error + '20' }]}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
            <Text style={[styles.actionText, { color: theme.colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...(Platform.OS === 'web' && {
      transition: 'all 0.2s ease-in-out',
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  issuer: {
    fontSize: 14,
  },
  statusContainer: {
    marginLeft: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flex: 1,
    marginRight: 12,
  },
  code: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginRight: 8,
    letterSpacing: 2,
  },
  timerContainer: {
    alignItems: 'center',
    minWidth: 40,
  },
  progressBar: {
    width: 32,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  timer: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});