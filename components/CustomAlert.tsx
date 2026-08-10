import type React from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Top edge of the dialog — fixed Y so growth extends downward only. */
const ALERT_TOP_OFFSET = SCREEN_HEIGHT * 0.35;
const ALERT_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;

export type CustomAlertAction = {
  text: string;
  variant?: 'primary' | 'secondary' | 'cancel';
  value?: string;
};

export interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  onCancel: () => void;
  onConfirm: (data?: unknown) => void;
  cancelText?: string;
  confirmText?: string;
  cancelable?: boolean;
  showCancelButton?: boolean;
  actions?: CustomAlertAction[];
  onAction?: (action: CustomAlertAction) => void;
  children?: React.ReactNode;
}

/** Themed modal: fixed top anchor, grows with content, scrolls after 85% screen height. */
export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  cancelable = true,
  showCancelButton = true,
  actions,
  onAction,
  children,
}) => {
  const { theme } = useTheme();

  const handleRequestClose = () => {
    if (cancelable) {
      onCancel();
    }
  };

  const renderActionButton = (action: CustomAlertAction, index: number) => {
    const isPrimary = action.variant === 'primary';
    const isCancel = action.variant === 'cancel';

    return (
      <TouchableOpacity
        key={`${action.text}-${index}`}
        style={[
          styles.actionButton,
          isPrimary && { backgroundColor: theme.colors.primary },
          isCancel && {
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
          },
          !isPrimary &&
            !isCancel && {
              backgroundColor: theme.colors.primaryLight,
              borderWidth: 1,
              borderColor: theme.colors.border,
            },
        ]}
        onPress={() => onAction?.(action)}
      >
        <Text
          style={[
            styles.actionButtonText,
            isPrimary && { color: theme.colors.buttonText },
            isCancel && { color: theme.colors.textSecondary },
            !isPrimary && !isCancel && { color: theme.colors.primary },
          ]}
        >
          {action.text}
        </Text>
      </TouchableOpacity>
    );
  };

  const footer =
    actions && actions.length > 0 ? (
      <View style={styles.actionsContainer}>{actions.map(renderActionButton)}</View>
    ) : (
      <View style={[styles.buttonContainer, !showCancelButton && styles.singleButtonContainer]}>
        {showCancelButton && (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={onCancel}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>{cancelText}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.confirmButton, { backgroundColor: theme.colors.primary }, !showCancelButton && styles.singleButton]}
          onPress={() => onConfirm()}
        >
          <Text style={[styles.confirmButtonText, { color: theme.colors.buttonText }]}>{confirmText}</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleRequestClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={[styles.alertContainer, { backgroundColor: theme.colors.card, maxHeight: ALERT_MAX_HEIGHT }]}>
              <ScrollView
                style={styles.bodyScroll}
                contentContainerStyle={styles.bodyScrollContent}
                bounces={false}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
                {message ? <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text> : null}
                {children}
                {footer}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    width: '100%',
    paddingTop: ALERT_TOP_OFFSET,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  alertContainer: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: SCREEN_WIDTH * 0.9,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  bodyScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyScrollContent: {
    flexGrow: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  singleButtonContainer: {
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  singleButton: {
    flex: 0,
    minWidth: '100%',
    marginHorizontal: 0,
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {},
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionsContainer: {
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
