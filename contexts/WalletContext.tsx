import React, { createContext, useContext, useState, useEffect } from 'react';
import { WalletService } from '../services/WalletService';
import { BlockchainService } from '../services/BlockchainService';
import { StorageService } from '../services/StorageService';
import { WalletStorageManager } from '../services/WalletStorageManager';
import { Wallet } from '../model/Wallet';

interface WalletContextType {
  wallet: Wallet | null;
  balance: number;
  maxKeys: number;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshBalance: () => Promise<void>;
  authenticate: () => Promise<boolean>;
  logout: () => void;
  refreshWallet: (wallet?: Wallet) => Promise<void>;
  refreshCounter: number;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const KEY_STORAGE_COST = 0.0001; // CCX cost per key storage

  const maxKeys = Math.floor(balance / KEY_STORAGE_COST);

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      setIsLoading(true);
      console.log('Initializing wallet...');
      
      // All authentication is now handled by WalletStorageManager.getWallet()
      // This includes biometric authentication, password prompts, and fallbacks
      console.log('Authentication will be handled by WalletStorageManager.getWallet()');
      
      try {
        // Wallet operations in separate try-catch to maintain auth state
        const wallet = await WalletService.getOrCreateWallet('home');
        console.log('Wallet loaded:', !!wallet, 'Address:', wallet?.getPublicAddress() || 'none');
        
        // If we got here, authentication was successful
        setIsAuthenticated(true);
        
        // CRITICAL: Check for corrupted wallet data
        if (wallet && wallet.getPublicAddress() && wallet.getPublicAddress().length < 20) {
          console.error('CRITICAL: Corrupted wallet detected, clearing storage...');
          await WalletService.forceClearAll();
          // Restart initialization after clearing
          return initializeWallet();
        }
        
        setWallet(wallet);
        await refreshBalance();
      } catch (walletError) {
        console.error('Error with wallet operations:', walletError);
        console.error('Wallet error details:', {
          message: walletError.message,
          stack: walletError.stack,
          name: walletError.name
        });
        // Don't change authentication state, just set balance to 0
        setBalance(0);
      }
    } catch (error) {
      console.error('Error initializing wallet:', error);
      console.error('Initialization error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      // Only set isAuthenticated to false if it was an auth error
      if (error.message === 'Authentication required') {
        setIsAuthenticated(false);
      }
      setBalance(0);
    } finally {
      setIsLoading(false);
      console.log('Wallet initialization completed, isLoading set to false');
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

  const refreshWallet = async (providedWallet?: Wallet) => {
    try {
      console.log('Refreshing wallet...');
      
      let walletToUse: Wallet | null = null;
      
      if (providedWallet) {
        // Use the provided wallet (no need to authenticate again)
        console.log('Using provided wallet:', !!providedWallet, 'Address:', providedWallet?.getPublicAddress() || 'none', 'isLocal:', providedWallet?.isLocal());
        walletToUse = providedWallet;
      } else {
        // Load wallet directly from storage without going through upgrade prompts
        walletToUse = await WalletStorageManager.getWallet();
        
        if (walletToUse) {
          console.log('Wallet loaded from storage:', !!walletToUse, 'Address:', walletToUse?.getPublicAddress() || 'none', 'isLocal:', walletToUse?.isLocal());
        } else {
          console.log('No wallet found during refresh - creating new local wallet');
          // If no wallet exists, create a new local wallet
          walletToUse = await WalletService.createLocalWallet();
        }
      }
      
      if (walletToUse) {
        setWallet(walletToUse);
        await refreshBalance();
        
        // Increment refresh counter to force component re-renders
        setRefreshCounter(prev => prev + 1);
        
        console.log('Wallet refreshed successfully');
      }
    } catch (error) {
      console.error('Error refreshing wallet:', error);
    }
  };

  const refreshBalance = async () => {
    if (wallet?.getPublicAddress()) {
      try {
        const currentBalance = await BlockchainService.getBalance(wallet.getPublicAddress());
        setBalance(currentBalance);
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance(0);
      }
    } else {
      // For local-only wallets or wallets without address, set balance to 0
      setBalance(0);
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
        refreshWallet,
        refreshCounter,
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