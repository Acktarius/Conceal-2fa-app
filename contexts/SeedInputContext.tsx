import type React from 'react';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { SeedInputModal } from '../components/SeedInputModal';

interface SeedInputContextType {
  showSeedInputModal: (onImport: (seedPhrase: string, creationHeight?: number) => void, onCancel: () => void) => void;
}

const SeedInputContext = createContext<SeedInputContextType | undefined>(undefined);

export const useSeedInput = () => {
  const context = useContext(SeedInputContext);
  if (!context) {
    throw new Error('useSeedInput must be used within a SeedInputProvider');
  }
  return context;
};

interface SeedInputProviderProps {
  children: ReactNode;
}

export const SeedInputProvider: React.FC<SeedInputProviderProps> = ({ children }) => {
  const [showModal, setShowModal] = useState(false);
  const [onImportCallback, setOnImportCallback] = useState<((seedPhrase: string, creationHeight?: number) => void) | null>(null);
  const [onCancelCallback, setOnCancelCallback] = useState<(() => void) | null>(null);

  const showSeedInputModal = (onImport: (seedPhrase: string, creationHeight?: number) => void, onCancel: () => void) => {
    console.log('SEED INPUT CONTEXT: showSeedInputModal called');
    setOnImportCallback(() => onImport);
    setOnCancelCallback(() => onCancel);
    setShowModal(true);
    console.log('SEED INPUT CONTEXT: Modal should be visible');
  };

  const handleImport = (seedPhrase: string, creationHeight?: number) => {
    console.log('SEED INPUT CONTEXT: handleImport called with seed phrase and height:', creationHeight);
    if (onImportCallback) {
      onImportCallback(seedPhrase, creationHeight);
    }
    setShowModal(false);
    setOnImportCallback(null);
    setOnCancelCallback(null);
  };

  const handleCancel = () => {
    console.log('SEED INPUT CONTEXT: handleCancel called');
    if (onCancelCallback) {
      onCancelCallback();
    }
    setShowModal(false);
    setOnImportCallback(null);
    setOnCancelCallback(null);
  };

  const contextValue: SeedInputContextType = {
    showSeedInputModal,
  };

  return (
    <SeedInputContext.Provider value={contextValue}>
      {children}
      <SeedInputModal visible={showModal} onImport={handleImport} onCancel={handleCancel} />
    </SeedInputContext.Provider>
  );
};
