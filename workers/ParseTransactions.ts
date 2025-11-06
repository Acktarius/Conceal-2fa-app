import type { RawDaemon_Transaction } from '../model/blockchain/BlockchainExplorer';
import { TransactionsExplorer } from '../model/TransactionsExplorer';
import { Wallet } from '../model/Wallet';

onmessage = (data: MessageEvent) => {
  // if(data.isTrusted){
  const event: any = data.data;
  try {
    if (event.type === 'initWallet') {
      postMessage({ type: 'readyWallet' });
    } else if (event.type === 'process') {
      const readMinersTx = typeof event.readMinersTx !== 'undefined' && event.readMinersTx;
      const rawTransactions: RawDaemon_Transaction[] = event.transactions;
      const maxBlockNumber: number = event.maxBlock;
      let currentWallet: Wallet | null = null;
      const transactions = [];

      if (rawTransactions.length > 0) {
        currentWallet = Wallet.loadFromRaw(event.wallet);
        logDebugMsg(`process new transactions...`);

        if (currentWallet === null) {
          logDebugMsg(`Wallet is missing...`);
          postMessage('missing_wallet');
          return;
        }

        // log any raw transactions that need to be processed
        logDebugMsg(`rawTransactions`, rawTransactions);

        for (const rawTransaction of rawTransactions) {
          if (rawTransaction) {
            if (rawTransaction.height) {
              if (!readMinersTx && TransactionsExplorer.isMinerTx(rawTransaction)) {
                continue;
              }

              try {
                // parse the raw transaction to include it into the wallet
                const txData = TransactionsExplorer.parse(rawTransaction, currentWallet);

                if (txData && txData.transaction) {
                  currentWallet.addNew(txData.transaction);
                  transactions.push(txData.export());
                }
              } catch (err) {
                console.error('Failed to parse tx:', rawTransaction, err);
              }
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
