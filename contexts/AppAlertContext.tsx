import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CustomAlert, type CustomAlertAction } from '../components/CustomAlert';
import { TextInputAlert } from '../components/TextInputAlert';

export type AppAlertChoice = {
  label: string;
  value: string;
  variant?: CustomAlertAction['variant'];
};

type MessageRequest = {
  kind: 'message';
  title: string;
  message?: string;
  resolve: () => void;
};

type ChoiceRequest = {
  kind: 'choice';
  title: string;
  message?: string;
  options: AppAlertChoice[];
  cancelable: boolean;
  resolve: (value: string) => void;
};

type TextInputRequest = {
  kind: 'textInput';
  title: string;
  message?: string;
  placeholder?: string;
  confirmLabel?: string;
  skipLabel?: string;
  initialValue?: string;
  validate?: (value: string) => string | null;
  resolve: (value: string | null) => void;
};

type PendingAlert = MessageRequest | ChoiceRequest | TextInputRequest;

interface AppAlertContextType {
  showMessageAlert: (title: string, message?: string) => Promise<void>;
  showChoiceAlert: (
    title: string,
    message: string | undefined,
    options: AppAlertChoice[],
    config?: { cancelable?: boolean }
  ) => Promise<string>;
  /** Resolves entered text, or `null` when the user skips. */
  showTextInputAlert: (
    title: string,
    message: string | undefined,
    config?: {
      placeholder?: string;
      confirmLabel?: string;
      skipLabel?: string;
      initialValue?: string;
      validate?: (value: string) => string | null;
    }
  ) => Promise<string | null>;
}

const AppAlertContext = createContext<AppAlertContextType | undefined>(undefined);

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingAlert | null>(null);

  const closePending = useCallback(() => {
    setPending(null);
  }, []);

  const showMessageAlert = useCallback(
    (title: string, message?: string) => {
      return new Promise<void>((resolve) => {
        setPending({
          kind: 'message',
          title,
          message,
          resolve: () => {
            resolve();
            closePending();
          },
        });
      });
    },
    [closePending]
  );

  const showChoiceAlert = useCallback(
    (title: string, message: string | undefined, options: AppAlertChoice[], config?: { cancelable?: boolean }) => {
      return new Promise<string>((promiseResolve) => {
        setPending({
          kind: 'choice',
          title,
          message,
          options,
          cancelable: config?.cancelable ?? true,
          resolve: (value: string) => {
            promiseResolve(value);
            closePending();
          },
        });
      });
    },
    [closePending]
  );

  const showTextInputAlert = useCallback(
    (
      title: string,
      message: string | undefined,
      config?: {
        placeholder?: string;
        confirmLabel?: string;
        skipLabel?: string;
        initialValue?: string;
        validate?: (value: string) => string | null;
      }
    ) => {
      return new Promise<string | null>((promiseResolve) => {
        setPending({
          kind: 'textInput',
          title,
          message,
          placeholder: config?.placeholder,
          confirmLabel: config?.confirmLabel,
          skipLabel: config?.skipLabel,
          initialValue: config?.initialValue,
          validate: config?.validate,
          resolve: (value: string | null) => {
            promiseResolve(value);
            closePending();
          },
        });
      });
    },
    [closePending]
  );

  useEffect(() => {
    (global as AppAlertGlobal).appAlertContext = {
      showMessageAlert,
      showChoiceAlert,
      showTextInputAlert,
    };
  }, [showMessageAlert, showChoiceAlert, showTextInputAlert]);

  const handleDismiss = () => {
    if (!pending) {
      return;
    }
    if (pending.kind === 'message') {
      pending.resolve();
      return;
    }
    if (pending.kind === 'choice' && pending.cancelable) {
      pending.resolve('cancel');
    }
  };

  const choiceActions: CustomAlertAction[] | undefined =
    pending?.kind === 'choice'
      ? pending.options.map((option) => ({
          text: option.label,
          variant: option.variant ?? 'secondary',
          value: option.value,
        }))
      : undefined;

  return (
    <AppAlertContext.Provider value={{ showMessageAlert, showChoiceAlert, showTextInputAlert }}>
      {children}
      {pending?.kind === 'message' && (
        <CustomAlert
          visible
          title={pending.title}
          message={pending.message}
          confirmText="OK"
          showCancelButton={false}
          cancelable
          onCancel={handleDismiss}
          onConfirm={handleDismiss}
        />
      )}
      {pending?.kind === 'choice' && (
        <CustomAlert
          visible
          title={pending.title}
          message={pending.message}
          actions={choiceActions}
          cancelable={pending.cancelable}
          onCancel={handleDismiss}
          onConfirm={() => {}}
          onAction={(action) => {
            if (pending.kind === 'choice') {
              pending.resolve(action.value ?? 'cancel');
            }
          }}
        />
      )}
      {pending?.kind === 'textInput' && (
        <TextInputAlert
          visible
          title={pending.title}
          message={pending.message}
          placeholder={pending.placeholder}
          confirmText={pending.confirmLabel ?? 'Add'}
          cancelText={pending.skipLabel ?? 'Skip'}
          initialValue={pending.initialValue}
          validate={pending.validate}
          onCancel={() => pending.resolve(null)}
          onConfirm={(value) => pending.resolve(value)}
        />
      )}
    </AppAlertContext.Provider>
  );
}

export function useAppAlert(): AppAlertContextType {
  const context = useContext(AppAlertContext);
  if (!context) {
    throw new Error('useAppAlert must be used within AppAlertProvider');
  }
  return context;
}

type AppAlertGlobal = typeof globalThis & {
  appAlertContext?: AppAlertContextType;
};

/** For services that cannot use hooks (same pattern as passwordPromptContext). */
export function getAppAlertContext(): AppAlertContextType {
  const context = (global as AppAlertGlobal).appAlertContext;
  if (!context) {
    throw new Error('App alert context not available. App must be properly initialized.');
  }
  return context;
}
