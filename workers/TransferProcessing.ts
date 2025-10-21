import type { RawDaemon_Transaction } from '../model/blockchain/BlockchainExplorer';
import { Constants } from '../model/Constants';
import { Mnemonic } from '../model/Mnemonic';
import { Transaction } from '../model/Transaction';
import { TransactionsExplorer } from '../model/TransactionsExplorer';
import { Wallet, WalletOptions } from '../model/Wallet';

//bridge for cnUtil with the new mnemonic class
(<any>self).mn_random = Mnemonic.mn_random;
(<any>self).mn_decode = Mnemonic.mn_decode;
(<any>self).mn_encode = Mnemonic.mn_encode;

onmessage = (data: MessageEvent) => {
  // if(data.isTrusted){
  const event: any = data.data;
  try {
    if (event.type === 'initWallet') {
      postMessage({ type: 'readyWallet' });
    } else if (event.type === 'process') {
      logDebugMsg(`process new transactions...`);

      const readMinersTx = typeof event.readMinersTx !== 'undefined' && event.readMinersTx;
      const rawTransactions: RawDaemon_Transaction[] = event.transactions;
      const maxBlockNumber: number = event.maxBlock;
      let currentWallet: Wallet | null = null;
      const transactions: any[] = [];

      // get the current wallet from even parameters
      currentWallet = Wallet.loadFromRaw(event.wallet);
      // log any raw transactions that need to be processed
      logDebugMsg(`rawTransactions`, rawTransactions);

      if (!currentWallet) {
        logDebugMsg(`Wallet is missing...`);
        postMessage('missing_wallet');
        return;
      }

      for (const rawTransaction of rawTransactions) {
        if (rawTransaction) {
          if (rawTransaction.height) {
            if (!readMinersTx && TransactionsExplorer.isMinerTx(rawTransaction)) {
              continue;
            }

            try {
              // parse the transaction to see if we need to include it in the wallet
              if (TransactionsExplorer.ownsTx(rawTransaction, currentWallet)) {
                transactions.push(rawTransaction);
              }
            } catch (err) {
              console.error('Failed to process ownsTx for tx:', rawTransaction);
            }
          }
        }
      }

      postMessage({
        type: 'processed',
        maxHeight: maxBlockNumber,
        transactions: transactions,
      });
    }
  } catch (err: any) {
    reportError(err);
  }
};

postMessage('ready');
