import React, { createContext, useContext, useState } from 'react';

interface PasswordPromptContextType {
  showPasswordPrompt: boolean;
  passwordPromptMessage: string;
  passwordPromptTitle: string;
  showPasswordPromptAlert: (title: string, message: string) => Promise<string | null>;
  handlePasswordPrompt: (password: string | null) => void;
}

const PasswordPromptContext = createContext<PasswordPromptContextType | undefined>(undefined);

export function PasswordPromptProvider({ children }: { children: React.ReactNode }) {
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordPromptMessage, setPasswordPromptMessage] = useState('');
  const [passwordPromptTitle, setPasswordPromptTitle] = useState('');
  const [passwordPromptResolve, setPasswordPromptResolve] = useState<((password: string | null) => void) | null>(null);

  const showPasswordPromptAlert = (title: string, message: string): Promise<string | null> => {
    console.log('PASSWORD CONTEXT: showPasswordPromptAlert called with:', title, message);
    return new Promise((resolve) => {
      console.log('PASSWORD CONTEXT: Setting state...');
      setPasswordPromptTitle(title);
      setPasswordPromptMessage(message);
      setPasswordPromptResolve(() => resolve);
      setShowPasswordPrompt(true);
      console.log('PASSWORD CONTEXT: State set, alert should be visible');
    });
  };

  const handlePasswordPrompt = (password: string | null) => {
    console.log('PASSWORD CONTEXT: handlePasswordPrompt called with:', password ? '***' : 'null');
    setShowPasswordPrompt(false);
    if (passwordPromptResolve) {
      console.log('PASSWORD CONTEXT: Resolving promise...');
      passwordPromptResolve(password);
      setPasswordPromptResolve(null);
    } else {
      console.log('PASSWORD CONTEXT: No resolve function available!');
    }
  };

  return (
    <PasswordPromptContext.Provider
      value={{
        showPasswordPrompt,
        passwordPromptMessage,
        passwordPromptTitle,
        showPasswordPromptAlert,
        handlePasswordPrompt,
      }}
    >
      {children}
    </PasswordPromptContext.Provider>
  );
}

export function usePasswordPrompt() {
  const context = useContext(PasswordPromptContext);
  if (context === undefined) {
    throw new Error('usePasswordPrompt must be used within a PasswordPromptProvider');
  }
  return context;
}
