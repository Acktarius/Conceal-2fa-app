import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { CustomAlert, CustomAlertProps } from './CustomAlert';
import { PasswordInput } from './PasswordInput';

interface UnlockWalletAlertProps extends Omit<CustomAlertProps, 'children' | 'onConfirm'> {
  onConfirm: (password: string) => void;
}

export const UnlockWalletAlert: React.FC<UnlockWalletAlertProps> = ({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  cancelText = 'Cancel',
  confirmText = 'Unlock',
}) => {
  const [password, setPassword] = useState('');

  const isFormValid = password.length > 0;

  const handleConfirm = () => {
    if (isFormValid) {
      onConfirm(password);
      // Reset form
      setPassword('');
    }
  };

  const handleCancel = () => {
    onCancel();
    // Reset form
    setPassword('');
  };

  return (
    <CustomAlert
      visible={visible}
      title={title}
      message={message}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      cancelText={cancelText}
      confirmText={confirmText}
    >
      <View style={styles.content}>
        <PasswordInput
          placeholder="Enter wallet password"
          value={password}
          onChangeText={setPassword}
          showValidation={false}
        />
      </View>
    </CustomAlert>
  );
};

const styles = StyleSheet.create({
  content: {
    marginTop: 8,
  },
});
