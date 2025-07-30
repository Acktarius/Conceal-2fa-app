import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
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

  const canSaveToBlockchain = walletBalance >= 0.0001 && sharedKey.isLocalOnly();
  const canBroadcast = !sharedKey.isLocalOnly() && isWalletSynced;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: theme.colors.card },
          isSelected && { borderColor: theme.colors.primary, borderWidth: 2 }
        ]}
        onPress={onSelect}
        activeOpacity={0.8}
      >
        {/* Header with service info */}
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
            {sharedKey.isLocalOnly() ? (
              <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.textSecondary} />
            ) : (
              <Ionicons name="cloud-done-outline" size={20} color={theme.colors.success} />
            )}
          </View>
        </View>

        {/* TOTP Code */}
        <View style={styles.codeContainer}>
          <Text style={[styles.code, { color: theme.colors.primary }]}>
            {sharedKey.code}
          </Text>
          <View style={styles.timeContainer}>
            <Text style={[styles.timeRemaining, { color: theme.colors.textSecondary }]}>
              {sharedKey.timeRemaining}s
            </Text>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: sharedKey.timeRemaining > 10 ? theme.colors.success : theme.colors.warning,
                    width: `${(sharedKey.timeRemaining / 30) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Action buttons when selected */}
        {isSelected && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.primaryLight }]}
              onPress={onCopy}
            >
              <Ionicons name="copy-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.actionText, { color: theme.colors.primary }]}>Copy</Text>
            </TouchableOpacity>

            {canSaveToBlockchain && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.primaryLight }]}
                onPress={onSaveToBlockchain}
              >
                <Ionicons name="cloud-upload-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.actionText, { color: theme.colors.primary }]}>Save</Text>
              </TouchableOpacity>
            )}

            {canBroadcast && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.primaryLight }]}
                onPress={onBroadcast}
              >
                <Ionicons name="radio-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.actionText, { color: theme.colors.primary }]}>Share</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.error + '20' }]}
              onPress={onDelete}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
              <Text style={[styles.actionText, { color: theme.colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  statusContainer: {
    marginLeft: 12,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  code: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  timeRemaining: {
    fontSize: 12,
    marginBottom: 4,
  },
  progressBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
});