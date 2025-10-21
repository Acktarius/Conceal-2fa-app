import type { RawDaemon_Transaction } from '../model/blockchain/BlockchainExplorer';
import { Constants } from '../model/Constants';
import { Mnemonic } from '../model/Mnemonic';
import { Transaction } from '../model/Transaction';
import { TransactionsExplorer } from '../model/TransactionsExplorer';
import { Wallet, WalletOptions } from '../model/Wallet';

// React Native thread worker for transfer processing
// Adapted from TransferProcessing.ts for react-native-threads

// Bridge for cnUtil with the new mnemonic class
if (typeof self !== 'undefined') {
  (self as any).mn_random = Mnemonic.mn_random;
  (self as any).mn_decode = Mnemonic.mn_decode;
  (self as any).mn_encode = Mnemonic.mn_encode;
}

let isReady = false;

// Initialize the worker
function initializeWorker() {
  console.log('TransferProcessingRN: Worker initializing...');
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
      console.log('TransferProcessingRN: Wallet initialization requested');
      if (typeof self !== 'undefined' && self.postMessage) {
        self.postMessage({ type: 'readyWallet' });
      }
    } else if (data.type === 'process') {
      processTransfers(data);
    }
  } catch (error) {
    console.error('TransferProcessingRN: Error handling message:', error);
    if (typeof self !== 'undefined' && self.postMessage) {
      self.postMessage({
        type: 'error',
        error: error.message,
      });
    }
  }
}

function processTransfers(data: any) {
  try {
    console.log('TransferProcessingRN: Processing transfers...');

    const readMinersTx = typeof data.readMinersTx !== 'undefined' && data.readMinersTx;
    const rawTransactions: RawDaemon_Transaction[] = data.transactions;
    const maxBlockNumber: number = data.maxBlock;
    let currentWallet: Wallet | null = null;
    const transactions: any[] = [];

    // Get the current wallet from event parameters
    currentWallet = Wallet.loadFromRaw(data.wallet);
    console.log('TransferProcessingRN: Raw transactions count:', rawTransactions.length);

    if (!currentWallet) {
      console.log('TransferProcessingRN: Wallet is missing...');
      if (typeof self !== 'undefined' && self.postMessage) {
        self.postMessage('missing_wallet');
      }
      return;
    }

    for (const rawTransaction of rawTransactions) {
      if (rawTransaction) {
        if (rawTransaction.height) {
          if (!readMinersTx && TransactionsExplorer.isMinerTx(rawTransaction)) {
            continue;
          }

          try {
            // Parse the transaction to see if we need to include it in the wallet
            if (TransactionsExplorer.ownsTx(rawTransaction, currentWallet)) {
              transactions.push(rawTransaction);
            }
          } catch (err) {
            console.error('TransferProcessingRN: Failed to process ownsTx for tx:', rawTransaction);
          }
        }
      }
    }

    if (typeof self !== 'undefined' && self.postMessage) {
      self.postMessage({
        type: 'processed',
        maxHeight: maxBlockNumber,
        transactions: transactions,
      });
    }
  } catch (err: any) {
    console.error('TransferProcessingRN: Error processing transfers:', err);
    if (typeof self !== 'undefined' && self.postMessage) {
      self.postMessage({
        type: 'error',
        error: err.message,
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
      console.error('TransferProcessingRN: Error parsing message:', error);
    }
  };
}
