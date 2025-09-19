import React, { createContext, useContext, useState, useEffect } from 'react';
import { WalletService } from '../services/WalletService';
import { StorageService } from '../services/StorageService';
import { WalletStorageManager } from '../services/WalletStorageManager';
import { Wallet } from '../model/Wallet';
import { config } from '../config';

interface WalletContextType {
  wallet: Wallet | null;
  balance: typeof JSBigInt;
  maxKeys: typeof JSBigInt;
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
  const [balance, setBalance] = useState(new JSBigInt(0));
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const KEY_STORAGE_COST = config.messageTxAmount.add(config.coinFee).add(config.remoteNodeFee);

  const maxKeys = balance.divide(KEY_STORAGE_COST);

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
        
        // Note: Removed aggressive corrupted wallet detection that was clearing valid wallets
        
        setWallet(wallet);
        
        // Debug: Log all transactions in the wallet
        if (wallet) {
          const transactions = wallet.getAll();
          console.log('WALLET DEBUG: Wallet loaded with transactions:', {
            totalTransactions: transactions.length,
            transactions
            });
          
          // Calculate balance immediately using the loaded wallet object
          console.log('BALANCE DEBUG: wallet.amount raw value:', wallet.amount);
          console.log('BALANCE DEBUG: wallet.availableAmount(-1):', wallet.availableAmount(-1));
          const currentBalance = new JSBigInt(wallet.amount);
          setBalance(currentBalance);
          console.log('BALANCE DEBUG: Set balance immediately after wallet load:', currentBalance);
          
          // Debug individual transactions to see why balance is 0
          console.log('BALANCE DEBUG: Transaction details:', transactions.map(tx => ({
            txHash: tx.hash?.substring(0, 16) + '...',
            isFullyChecked: tx.isFullyChecked(),
            outsCount: tx.outs?.length || 0,
            insCount: tx.ins?.length || 0,
            outs: tx.outs?.map(out => ({ amount: out.amount, type: out.type })) || [],
            ins: tx.ins?.map(inp => ({ amount: inp.amount, type: inp.type })) || []
          })));
        } else {
          console.log('WALLET DEBUG: No wallet available');
        }
        
        // Note: refreshBalance() removed - balance is already calculated and set above
        
        // Start wallet synchronization if it's a blockchain wallet
        if (wallet && !wallet.isLocal()) {
          try {
            await WalletService.startWalletSynchronization();
            console.log('Wallet synchronization started for blockchain wallet');
          } catch (error) {
            console.error('Error starting wallet synchronization:', error);
            // Continue without synchronization
          }
        }
      } catch (walletError) {
        console.error('Error with wallet operations:', walletError);
        console.error('Wallet error details:', {
          message: walletError.message,
          stack: walletError.stack,
          name: walletError.name
        });
        // Don't change authentication state, just set balance to 0
        setBalance(new JSBigInt(0));
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
      setBalance(new JSBigInt(0));
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
      console.log('REFRESH WALLET: Starting refresh...', {
        hasProvidedWallet: !!providedWallet,
        providedWalletAddress: providedWallet?.getPublicAddress() || 'none',
        providedWalletIsLocal: providedWallet?.isLocal(),
        providedWalletCreationHeight: providedWallet?.creationHeight,
        providedWalletLastHeight: providedWallet?.lastHeight
      });
      
      let walletToUse: Wallet | null = null;
      
      if (providedWallet) {
        // Use the provided wallet (no need to authenticate again)
        console.log('REFRESH WALLET: Using provided wallet');
        walletToUse = providedWallet;
      } else {
        // Load wallet directly from storage without going through upgrade prompts
        console.log('REFRESH WALLET: Loading wallet from storage...');
        walletToUse = await WalletStorageManager.getWallet();
        
        if (walletToUse) {
          console.log('REFRESH WALLET: Wallet loaded from storage:', {
            hasWallet: !!walletToUse,
            address: walletToUse?.getPublicAddress() || 'none',
            isLocal: walletToUse?.isLocal(),
            creationHeight: walletToUse?.creationHeight,
            lastHeight: walletToUse?.lastHeight,
            hasKeys: !!walletToUse?.keys,
            hasSpendKey: !!walletToUse?.keys?.priv?.spend
          });
        } else {
          console.log('REFRESH WALLET: No wallet found during refresh - creating new local wallet');
          // If no wallet exists, create a new local wallet
          walletToUse = await WalletService.createLocalWallet();
        }
      }
      
      if (walletToUse) {
        setWallet(walletToUse);
        await refreshBalance();
        
        // Start wallet synchronization if it's a blockchain wallet
        if (!walletToUse.isLocal()) {
          try {
            await WalletService.startWalletSynchronization();
            console.log('Wallet synchronization started for blockchain wallet');
          } catch (error) {
            console.error('Error starting wallet synchronization:', error);
            // Continue without synchronization
          }
        }
        
        // Increment refresh counter to force component re-renders
        setRefreshCounter(prev => prev + 1);
        
        console.log('Wallet refreshed successfully');
      }
    } catch (error) {
      console.error('Error refreshing wallet:', error);
    }
  };

  const refreshBalance = async () => {
    if (wallet) {
      try {
        // Debug: Log wallet state before balance calculation
        const transactions = wallet.getAll();
        console.log('BALANCE DEBUG: Before balance calculation:', {
          transactionsCount: transactions.length,
          rawAmount: wallet.amount
        });
        
        // Use wallet's own balance calculation with current blockchain height
        // -1 means use current blockchain height (default behavior)
          const currentBalance = new JSBigInt(wallet.amount);
        
        setBalance(currentBalance);
      } catch (error) {
        console.error('Error calculating wallet balance:', error);
        setBalance(new JSBigInt(0));
      }
    } else {
      console.log('BALANCE DEBUG: No wallet available, setting balance to 0');
      setBalance(new JSBigInt(0));
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