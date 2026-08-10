import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SpinningSyncIcon } from '../components/SpinningSyncIcon';
import { useTheme } from './ThemeContext';

interface ImportProgressContextType {
  showImportProgress: (message: string) => void;
  updateImportProgress: (message: string) => void;
  hideImportProgress: () => void;
  runWithImportProgress: <T>(message: string, fn: (updateMessage: (message: string) => void) => Promise<T>) => Promise<T>;
}

const ImportProgressContext = createContext<ImportProgressContextType | undefined>(undefined);

/** Root View overlay (not Modal) so iOS biometrics and dialogs are not blocked by modal stacking. */
export function ImportProgressProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [message, setMessage] = useState<string | null>(null);

  const showImportProgress = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
  }, []);

  const updateImportProgress = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
  }, []);

  const hideImportProgress = useCallback(() => {
    setMessage(null);
  }, []);

  const runWithImportProgress = useCallback(
    async <T,>(initialMessage: string, fn: (updateMessage: (message: string) => void) => Promise<T>): Promise<T> => {
      setMessage(initialMessage);
      try {
        return await fn(setMessage);
      } finally {
        setMessage(null);
      }
    },
    []
  );

  useEffect(() => {
    (global as ImportProgressGlobal).importProgressContext = {
      showImportProgress,
      updateImportProgress,
      hideImportProgress,
      runWithImportProgress,
    };
  }, [showImportProgress, updateImportProgress, hideImportProgress, runWithImportProgress]);

  return (
    <ImportProgressContext.Provider value={{ showImportProgress, updateImportProgress, hideImportProgress, runWithImportProgress }}>
      {children}
      {message !== null && (
        <View style={styles.host} pointerEvents="auto">
          <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <SpinningSyncIcon size={28} color={theme.colors.primary} />
            <Text style={[styles.message, { color: theme.colors.text }]}>{message}</Text>
          </View>
        </View>
      )}
    </ImportProgressContext.Provider>
  );
}

export function useImportProgress(): ImportProgressContextType {
  const context = useContext(ImportProgressContext);
  if (!context) {
    throw new Error('useImportProgress must be used within ImportProgressProvider');
  }
  return context;
}

type ImportProgressGlobal = typeof globalThis & {
  importProgressContext?: ImportProgressContextType;
};

/** For ImportService and other non-hook callers. */
export function getImportProgress(): ImportProgressContextType {
  const context = (global as ImportProgressGlobal).importProgressContext;
  if (!context) {
    throw new Error('Import progress context not available. App must be properly initialized.');
  }
  return context;
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    padding: 24,
  },
  card: {
    minWidth: 220,
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  message: {
    marginTop: 12,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
