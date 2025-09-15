import React, { useState } from 'react';
import { CustomAlert, CustomAlertProps } from './CustomAlert';
import { PasswordInput } from './PasswordInput';

interface PasswordInputAlertProps extends Omit<CustomAlertProps, 'children' | 'onConfirm'> {
  onConfirm: (password: string) => void;
}

export const PasswordInputAlert: React.FC<PasswordInputAlertProps> = ({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
}) => {
  const [password, setPassword] = useState('');

  const handleConfirm = () => {
    if (password.length > 0) {
      onConfirm(password);
      // Reset form after successful password input
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
      confirmText="Unlock"
    >
      <PasswordInput
        placeholder="Enter wallet password"
        value={password}
        onChangeText={setPassword}
      />
    </CustomAlert>
  );
};
