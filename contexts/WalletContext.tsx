import React, { createContext, useContext, useState, useEffect } from 'react';
import { WalletService } from '../services/WalletService';
import { BlockchainService } from '../services/BlockchainService';

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
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const KEY_STORAGE_COST = 0.0001; // CCX cost per key storage

  const maxKeys = Math.floor(balance / KEY_STORAGE_COST);

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      setIsLoading(true);
      const walletData = await WalletService.getOrCreateWallet();
      setWallet(walletData);
      await refreshBalance();
    } catch (error) {
      console.error('Error initializing wallet:', error);
    } finally {
      setIsLoading(false);
    }
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
        refreshBalance,
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