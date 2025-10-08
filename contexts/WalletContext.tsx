import React, { createContext, useContext, useState, useEffect } from 'react';
import { WalletService } from '../services/WalletService';
import { StorageService } from '../services/StorageService';
import { WalletStorageManager } from '../services/WalletStorageManager';
import { CronBuddy } from '../services/CronBuddy';
import { Wallet } from '../model/Wallet';
import { config } from '../config';
import { getGlobalWorkletLogging } from '../services/interfaces/IWorkletLogging';
import { Alert } from 'react-native';

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
  const [alreadyAsked, setAlreadyAsked] = useState(false);
  const KEY_STORAGE_COST = config.messageTxAmount.add(config.coinFee).add(config.remoteNodeFee);

  const maxKeys = balance.divide(KEY_STORAGE_COST);

  const promptUserForSynchronization = () => {
    Alert.alert(
      'Wallet Synchronization',
      'Wallet synchronization is about to start. This will sync your wallet with the blockchain and may temporarily slow down the app.',
      [
        {
          text: 'Delay 45s',
          onPress: () => {
            getGlobalWorkletLogging().logging1string('User delayed synchronization by 45 seconds');
            setTimeout(() => {
              promptUserForSynchronization();
            }, 45000);
          }
        },
        {
          text: 'OK',
          onPress: async () => {
            try {
              getGlobalWorkletLogging().logging1string('User approved synchronization, starting now...');
              await WalletService.startWalletSynchronization();
              getGlobalWorkletLogging().logging1string('Wallet synchronization started successfully');
            } catch (error) {
              console.error('Error starting wallet synchronization:', error);
              Alert.alert('Error', 'Failed to start wallet synchronization. Please try again.');
            }
          }
        }
      ],
      { cancelable: false }
    );
  };

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
        
        if (wallet) {
          // Calculate balance immediately using the loaded wallet object
          const currentBalance = new JSBigInt(wallet.amount);
          setBalance(currentBalance);
        }
        
        // Note: refreshBalance() removed - balance is already calculated and set above
        /*
        // Start wallet synchronization if it's a blockchain wallet (with user confirmation after 5s delay)
        if (wallet && !wallet.isLocal()) {
          getGlobalWorkletLogging().logging1string('Wallet is blockchain-enabled, scheduling synchronization prompt in 5 seconds...');
          if (!alreadyAsked) {
          setAlreadyAsked(true);
          setTimeout(() => {
            promptUserForSynchronization();
          }, 5000);
        } else {
          await WalletService.startWalletSynchronization();
        }
        */        
        // Call refreshWallet to start CronBuddy and complete initialization
        await refreshWallet(wallet);
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
        
        // Simple wallet observer - observe the CACHED wallet that WalletWatchdogRN modifies
        const cachedWallet = WalletService.getCachedWallet();
        if (cachedWallet) {
          cachedWallet.addObserver('modified', (eventType: string, data: any) => {
            refreshBalance();
          });
        }
        
        // PRAGMATIC APPROACH: Register direct callback for balance refresh
        WalletService.registerBalanceRefreshCallback(refreshBalance);
        
        // Start wallet synchronization if it's a blockchain wallet
        if (!walletToUse.isLocal()) {
          try {
            if (!alreadyAsked) {
              // First time - show prompt after 5 seconds
              getGlobalWorkletLogging().logging1string('Wallet is blockchain-enabled, scheduling synchronization prompt in 5 seconds...');
              setAlreadyAsked(true);
              setTimeout(() => {
                promptUserForSynchronization();
              }, 5000);
            } else {
              // Already asked - start sync directly
              await WalletService.startWalletSynchronization();
            }
            // Start CronBuddy when wallet is blockchain and synced
            const syncStatus = await WalletService.getWalletSyncStatus();
            console.log('WALLET CONTEXT: Sync status:', syncStatus);
            if (syncStatus.isWalletSynced) {
              console.log('WALLET CONTEXT: Starting CronBuddy...');
              CronBuddy.start();
              console.log('WALLET CONTEXT: CronBuddy started for synced blockchain wallet');
              console.log('WALLET CONTEXT: CronBuddy is active:', CronBuddy.isActive());
            } else {
              console.log('WALLET CONTEXT: Wallet not synced, not starting CronBuddy');
            }
          } catch (error) {
            console.error('Error starting wallet synchronization:', error);
            // Continue without synchronization
          }
        } else {
          // Stop CronBuddy if wallet becomes local
          CronBuddy.stop();
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
    // Use the cached wallet from WalletService, not the state variable
    // This ensures we're always using the most up-to-date wallet instance
    const cachedWallet = WalletService.getCachedWallet();
    
    if (cachedWallet) {
      try {
        const currentBalance = new JSBigInt(cachedWallet.amount);
        setBalance(currentBalance);
      } catch (error) {
        console.error('Error calculating wallet balance:', error);
        setBalance(new JSBigInt(0));
      }
    } else {
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