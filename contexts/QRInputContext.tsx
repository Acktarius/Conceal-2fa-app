import type React from 'react';
import { createContext, useContext, useState } from 'react';
import QRScannerModal from '../components/QRScannerModal';

export interface QRInputContextType {
  showQRScannerModal: (onScan: (qrData: string) => void, onCancel: () => void) => void;
}

const QRInputContext = createContext<QRInputContextType | undefined>(undefined);

export const QRInputProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [onScanCallback, setOnScanCallback] = useState<((qrData: string) => void) | null>(null);
  const [onCancelCallback, setOnCancelCallback] = useState<(() => void) | null>(null);

  const showQRScannerModal = (onScan: (qrData: string) => void, onCancel: () => void) => {
    setOnScanCallback(() => onScan);
    setOnCancelCallback(() => onCancel);
    setIsVisible(true);
  };

  const handleScan = (qrData: string) => {
    setIsVisible(false);
    if (onScanCallback) {
      onScanCallback(qrData);
    }
    // Clear callbacks
    setOnScanCallback(null);
    setOnCancelCallback(null);
  };

  const handleCancel = () => {
    setIsVisible(false);
    if (onCancelCallback) {
      onCancelCallback();
    }
    // Clear callbacks
    setOnScanCallback(null);
    setOnCancelCallback(null);
  };

  return (
    <QRInputContext.Provider value={{ showQRScannerModal }}>
      {children}
      <QRScannerModal visible={isVisible} onClose={handleCancel} onScan={handleScan} />
    </QRInputContext.Provider>
  );
};

export const useQRInput = (): QRInputContextType => {
  const context = useContext(QRInputContext);
  if (!context) {
    throw new Error('useQRInput must be used within a QRInputProvider');
  }
  return context;
};
