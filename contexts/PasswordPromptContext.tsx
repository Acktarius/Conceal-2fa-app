import type React from 'react';
import { createContext, useContext, useState } from 'react';

interface PasswordPromptContextType {
  showPasswordPrompt: boolean;
  passwordPromptMessage: string;
  passwordPromptTitle: string;
  showPasswordPromptAlert: (title: string, message: string) => Promise<string | null>;
  showPasswordCreationAlert: (title: string, message: string) => Promise<string | null>;
  handlePasswordPrompt: (password: string | null) => void;
  // Password creation state
  showPasswordCreation: boolean;
  passwordCreationMessage: string;
  passwordCreationTitle: string;
  handlePasswordCreation: (password: string | null) => void;
}

const PasswordPromptContext = createContext<PasswordPromptContextType | undefined>(undefined);

export function PasswordPromptProvider({ children }: { children: React.ReactNode }) {
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordPromptMessage, setPasswordPromptMessage] = useState('');
  const [passwordPromptTitle, setPasswordPromptTitle] = useState('');
  const [passwordPromptResolve, setPasswordPromptResolve] = useState<((password: string | null) => void) | null>(null);

  // Password creation state
  const [showPasswordCreation, setShowPasswordCreation] = useState(false);
  const [passwordCreationMessage, setPasswordCreationMessage] = useState('');
  const [passwordCreationTitle, setPasswordCreationTitle] = useState('');
  const [passwordCreationResolve, setPasswordCreationResolve] = useState<((password: string | null) => void) | null>(
    null
  );

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

  const showPasswordCreationAlert = (title: string, message: string): Promise<string | null> => {
    console.log('PASSWORD CREATION CONTEXT: showPasswordCreationAlert called with:', title, message);
    return new Promise((resolve) => {
      console.log('PASSWORD CREATION CONTEXT: Setting state...');
      setPasswordCreationTitle(title);
      setPasswordCreationMessage(message);
      setPasswordCreationResolve(() => resolve);
      setShowPasswordCreation(true);
      console.log('PASSWORD CREATION CONTEXT: State set, alert should be visible');
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

  const handlePasswordCreation = (password: string | null) => {
    console.log('PASSWORD CREATION CONTEXT: handlePasswordCreation called with:', password ? '***' : 'null');
    setShowPasswordCreation(false);
    if (passwordCreationResolve) {
      console.log('PASSWORD CREATION CONTEXT: Resolving promise...');
      passwordCreationResolve(password);
      setPasswordCreationResolve(null);
    } else {
      console.log('PASSWORD CREATION CONTEXT: No resolve function available!');
    }
  };

  return (
    <PasswordPromptContext.Provider
      value={{
        showPasswordPrompt,
        passwordPromptMessage,
        passwordPromptTitle,
        showPasswordPromptAlert,
        showPasswordCreationAlert,
        handlePasswordPrompt,
        showPasswordCreation,
        passwordCreationMessage,
        passwordCreationTitle,
        handlePasswordCreation,
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
