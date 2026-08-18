import type React from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { CustomAlert } from './CustomAlert';

export type TextInputAlertProps = {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
  validate?: (value: string) => string | null;
  initialValue?: string;
};

/** Themed single-line input inside CustomAlert (Add / Skip). */
export const TextInputAlert: React.FC<TextInputAlertProps> = ({
  visible,
  title,
  message,
  placeholder,
  confirmText = 'Add',
  cancelText = 'Skip',
  onCancel,
  onConfirm,
  validate,
  initialValue = '',
}) => {
  const { theme } = useTheme();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setError(null);
    }
  }, [visible, initialValue]);

  const reset = () => {
    setValue(initialValue);
    setError(null);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (validate) {
      const validationError = validate(trimmed);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    reset();
    onConfirm(trimmed);
  };

  return (
    <CustomAlert
      visible={visible}
      title={title}
      message={message}
      confirmText={confirmText}
      cancelText={cancelText}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    >
      <View style={styles.inputWrap}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: error ? theme.colors.error : theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          value={value}
          onChangeText={(text) => {
            setValue(text);
            if (error) {
              setError(null);
            }
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
        {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}
      </View>
    </CustomAlert>
  );
};

const styles = StyleSheet.create({
  inputWrap: {
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  error: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});
