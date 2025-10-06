import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CustomAlert, CustomAlertProps } from './CustomAlert';
import { PasswordInput } from './PasswordInput';
import { validatePassword, validatePasswordMatch, getPasswordStrengthText } from '../utils/passwordValidation';

interface PasswordCreationAlertProps extends Omit<CustomAlertProps, 'children' | 'onConfirm'> {
  onConfirm: (password: string) => void;
}

export const PasswordCreationAlert: React.FC<PasswordCreationAlertProps> = ({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  cancelText = 'Cancel',
  confirmText = 'Create Password',
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showValidation, setShowValidation] = useState(false);

  const passwordValidation = validatePassword(password);
  const passwordsMatch = validatePasswordMatch(password, confirmPassword);
  const isFormValid = passwordValidation.isValid && passwordsMatch && password.length > 0;

  const handleConfirm = () => {
    if (isFormValid) {
      onConfirm(password);
      // Reset form
      setPassword('');
      setConfirmPassword('');
      setShowValidation(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    // Reset form
    setPassword('');
    setConfirmPassword('');
    setShowValidation(false);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
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
          placeholder="Enter new password"
          value={password}
          onChangeText={handlePasswordChange}
          isValid={passwordValidation.isValid}
          showValidation={showValidation}
        />
        
        <PasswordInput
          placeholder="Confirm new password"
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          isValid={passwordsMatch}
          errorMessage={showValidation && !passwordsMatch && confirmPassword.length > 0 ? 'Passwords do not match' : undefined}
          showValidation={showValidation}
        />
        
        {showValidation && password.length > 0 && (
          <View style={styles.validationContainer}>
            <Text style={[
              styles.validationText,
              passwordValidation.isValid ? styles.validationSuccess : styles.validationError
            ]}>
              {getPasswordStrengthText(passwordValidation)}
            </Text>
            
            {passwordValidation.errors.length > 0 && (
              <View style={styles.errorList}>
                {passwordValidation.errors.map((error, index) => (
                  <Text key={index} style={styles.errorItem}>• {error}</Text>
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
