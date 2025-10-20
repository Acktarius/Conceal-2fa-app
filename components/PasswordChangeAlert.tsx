import type React from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getPasswordStrengthText, validatePassword, validatePasswordMatch } from '../utils/passwordValidation';
import { CustomAlert, type CustomAlertProps } from './CustomAlert';
import { PasswordInput } from './PasswordInput';

interface PasswordChangeAlertProps extends Omit<CustomAlertProps, 'children' | 'onConfirm'> {
  onConfirm: (oldPassword: string, newPassword: string) => Promise<void>;
}

export const PasswordChangeAlert: React.FC<PasswordChangeAlertProps> = ({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  cancelText = 'Cancel',
  confirmText = 'Change Password',
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showValidation, setShowValidation] = useState(false);

  const passwordValidation = validatePassword(newPassword);
  const passwordsMatch = validatePasswordMatch(newPassword, confirmPassword);
  const isFormValid = oldPassword.length > 0 && passwordValidation.isValid && passwordsMatch && newPassword.length > 0;

  const handleConfirm = async () => {
    if (isFormValid) {
      await onConfirm(oldPassword, newPassword);
      // Reset form after successful password change
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowValidation(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    // Reset form
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowValidation(false);
  };

  const handleNewPasswordChange = (text: string) => {
    setNewPassword(text);
    if (text.length > 0) {
      setShowValidation(true);
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (text.length > 0) {
      setShowValidation(true);
    }
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
          placeholder="Enter current password"
          value={oldPassword}
          onChangeText={setOldPassword}
          showValidation={false}
        />

        <PasswordInput
          placeholder="Enter new password"
          value={newPassword}
          onChangeText={handleNewPasswordChange}
          isValid={passwordValidation.isValid}
          showValidation={showValidation}
        />

        <PasswordInput
          placeholder="Confirm new password"
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          isValid={passwordsMatch}
          errorMessage={
            showValidation && !passwordsMatch && confirmPassword.length > 0 ? 'Passwords do not match' : undefined
          }
          showValidation={showValidation}
        />

        {showValidation && newPassword.length > 0 && (
          <View style={styles.validationContainer}>
            <Text
              style={[
                styles.validationText,
                passwordValidation.isValid ? styles.validationSuccess : styles.validationError,
              ]}
            >
              {getPasswordStrengthText(passwordValidation)}
            </Text>

            {passwordValidation.errors.length > 0 && (
              <View style={styles.errorList}>
                {passwordValidation.errors.map((error, index) => (
                  <Text key={index} style={styles.errorItem}>
                    • {error}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </CustomAlert>
  );
};

const styles = StyleSheet.create({
  content: {
    marginTop: 8,
  },
  validationContainer: {
    marginTop: 8,
  },
  validationText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  validationSuccess: {
    color: '#28a745',
  },
  validationError: {
    color: '#dc3545',
  },
  errorList: {
    marginTop: 4,
  },
  errorItem: {
    fontSize: 12,
    color: '#dc3545',
    marginBottom: 2,
  },
});
