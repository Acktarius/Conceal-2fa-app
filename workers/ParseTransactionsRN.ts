import {Constants} from "../model/Constants";
import {Transaction} from "../model/Transaction";
import {Wallet, WalletOptions} from "../model/Wallet";
import {TransactionData} from "../model/Transaction";
import {TransactionsExplorer} from "../model/TransactionsExplorer";
import type {RawDaemon_Transaction} from "../model/blockchain/BlockchainExplorer";

// React Native thread worker for parsing transactions
// Adapted from ParseTransactions.ts for react-native-threads

let isReady = false;

// Initialize the worker
function initializeWorker() {
  console.log('ParseTransactionsRN: Worker initializing...');
  isReady = true;
  
  // Send ready signal
  if (typeof self !== 'undefined' && self.postMessage) {
    self.postMessage('ready');
  }
}

// Handle incoming messages
function handleMessage(data: any) {
  try {
    if (data.type === 'initWallet') {
      console.log('ParseTransactionsRN: Wallet initialization requested');
      if (typeof self !== 'undefined' && self.postMessage) {
        self.postMessage({ type: 'readyWallet' });
      }
    } else if (data.type === 'process') {
      processTransactions(data);
    }
  } catch (error) {
    console.error('ParseTransactionsRN: Error handling message:', error);
    if (typeof self !== 'undefined' && self.postMessage) {
      self.postMessage({
        type: 'error',
        error: error.message
      });
    }
  }
}

function processTransactions(data: any) {
  try {
    const readMinersTx = typeof data.readMinersTx !== 'undefined' && data.readMinersTx;
    const rawTransactions: RawDaemon_Transaction[] = data.transactions;
    const maxBlockNumber: number = data.maxBlock;
    let currentWallet: Wallet | null = null;
    const transactions = [];

    if (rawTransactions.length > 0) {
      currentWallet = Wallet.loadFromRaw(data.wallet);
      console.log('ParseTransactionsRN: Processing transactions...');

      if (currentWallet === null) {
        console.log('ParseTransactionsRN: Wallet is missing...');
        if (typeof self !== 'undefined' && self.postMessage) {
          self.postMessage('missing_wallet');
        }
        return;
      }

      console.log('ParseTransactionsRN: Raw transactions count:', rawTransactions.length);

      for (const rawTransaction of rawTransactions) {
        if (rawTransaction) {
          if (rawTransaction.height) {
            if (!readMinersTx && TransactionsExplorer.isMinerTx(rawTransaction)) {
              continue;
            }

            try {
              // Parse the raw transaction to include it into the wallet
              const txData = TransactionsExplorer.parse(rawTransaction, currentWallet);

              if (txData && txData.transaction) {
                currentWallet.addNew(txData.transaction);
                currentWallet.addDeposits(txData.deposits);
                currentWallet.addWithdrawals(txData.withdrawals);
                transactions.push(txData.export());
              }
            } catch (err) {
              console.error('ParseTransactionsRN: Failed to parse tx:', rawTransaction);
            }
          }
        }
      }
    }

    if (typeof self !== 'undefined' && self.postMessage) {
      self.postMessage({
        type: 'processed',
        maxHeight: maxBlockNumber,
        transactions: transactions
      });
    }
  } catch (err: any) {
    console.error('ParseTransactionsRN: Error processing transactions:', err);
    if (typeof self !== 'undefined' && self.postMessage) {
      self.postMessage({
        type: 'error',
        error: err.message
      });
    }
  }
}

// Initialize when the worker starts
initializeWorker();

// Export for react-native-threads
if (typeof self !== 'undefined') {
  self.onmessage = (message: any) => {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message;
      handleMessage(data);
    } catch (error) {
      console.error('ParseTransactionsRN: Error parsing message:', error);
    }
  };
}
