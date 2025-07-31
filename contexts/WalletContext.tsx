import React, { createContext, useContext, useState, useEffect } from 'react';
import { WalletService } from '../services/WalletService';
import { BlockchainService } from '../services/BlockchainService';
import { StorageService } from '../services/StorageService';
import { WalletStorageManager } from '../services/WalletStorageManager';

interface WalletData {
  address: string;
  privateKey: string;
  publicKey: string;
  seed: string;
}

interface WalletContextType {
  wallet: WalletData | null;
  balance: number;
  maxKeys: number;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshBalance: () => Promise<void>;
  authenticate: () => Promise<boolean>;
  logout: () => void;
  resetWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const KEY_STORAGE_COST = 0.0001; // CCX cost per key storage

  const maxKeys = Math.floor(balance / KEY_STORAGE_COST);

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      setIsLoading(true);
      console.log('Initializing wallet...');
      
      // Check if biometric auth is enabled (defaults to true)
      const settings = await StorageService.getSettings();
      const biometricEnabled = settings.biometricAuth !== false; // Default to true if not set
      
      if (biometricEnabled) {
        const authSuccess = await WalletService.authenticateUser();
        if (!authSuccess) {
          setIsAuthenticated(false);
          throw new Error('Authentication required');
        }
        setIsAuthenticated(true);
      } else {
        // If biometric is disabled, we're automatically authenticated
        setIsAuthenticated(true);
      }
      
      try {
        // Wallet operations in separate try-catch to maintain auth state
        const walletData = await WalletStorageManager.getWallet();
        if (walletData) {
          setWallet(walletData);
          await refreshBalance();
        } else {
          const newWallet = await WalletService.getOrCreateWallet();
          setWallet(newWallet);
          await refreshBalance();
        }
      } catch (walletError) {
        console.error('Error with wallet operations:', walletError);
        // Don't change authentication state, just set balance to 0
        setBalance(0);
      }
    } catch (error) {
      console.error('Error initializing wallet:', error);
      // Only set isAuthenticated to false if it was an auth error
      if (error.message === 'Authentication required') {
        setIsAuthenticated(false);
      }
      setBalance(0);
    } finally {
      setIsLoading(false);
    }
  };

  const authenticate = async (): Promise<boolean> => {
    try {
      const success = await WalletService.authenticateUser();
      setIsAuthenticated(success);
      return success;
    } catch (error) {
      console.error('Authentication error:', error);
      setIsAuthenticated(false);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    // Don't clear wallet data, just mark as not authenticated
  };

  const resetWallet = () => {
    setIsAuthenticated(false);
    setWallet(null);
    setBalance(0);
  };

  const refreshBalance = async () => {
    if (wallet?.address) {
      try {
        const currentBalance = await BlockchainService.getBalance(wallet.address);
        setBalance(currentBalance);
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance(0);
      }
    }
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        balance,
        maxKeys,
        isLoading,
        isAuthenticated,
        refreshBalance,
        authenticate,
        logout,
        resetWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}