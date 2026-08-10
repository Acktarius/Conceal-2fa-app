import type React from 'react';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { WalletFileInputModal } from '../components/WalletFileInputModal';

interface WalletFileInputContextType {
  showWalletFileInputModal: (onImport: (fileContent: string) => void, onCancel: () => void) => void;
}

const WalletFileInputContext = createContext<WalletFileInputContextType | undefined>(undefined);

export const useWalletFileInput = () => {
  const context = useContext(WalletFileInputContext);
  if (!context) {
    throw new Error('useWalletFileInput must be used within a WalletFileInputProvider');
  }
  return context;
};

interface WalletFileInputProviderProps {
  children: ReactNode;
}

export const WalletFileInputProvider: React.FC<WalletFileInputProviderProps> = ({ children }) => {
  const [showModal, setShowModal] = useState(false);
  const [onImportCallback, setOnImportCallback] = useState<((fileContent: string) => void) | null>(null);
  const [onCancelCallback, setOnCancelCallback] = useState<(() => void) | null>(null);

  const showWalletFileInputModal = (onImport: (fileContent: string) => void, onCancel: () => void) => {
    setOnImportCallback(() => onImport);
    setOnCancelCallback(() => onCancel);
    setShowModal(true);
  };

  const handleImport = (fileContent: string) => {
    setShowModal(false);
    onImportCallback?.(fileContent);
    setOnImportCallback(null);
    setOnCancelCallback(null);
  };

  const handleCancel = () => {
    setShowModal(false);
    onCancelCallback?.();
    setOnImportCallback(null);
    setOnCancelCallback(null);
  };

  return (
    <WalletFileInputContext.Provider value={{ showWalletFileInputModal }}>
      {children}
      <WalletFileInputModal visible={showModal} onImport={handleImport} onCancel={handleCancel} />
    </WalletFileInputContext.Provider>
  );
};
