/**
 *     Copyright (c) 2018-2020, ExploShot
 *     Copyright (c) 2018-2020, The Qwertycoin Project
 *     Copyright (c) 2018-2025, The Conceal Network, Conceal Devs
 *     Copyright (c) 2025, Acktarius 
 *
 *     All rights reserved.
 *     Redistribution and use in source and binary forms, with or without modification,
 *     are permitted provided that the following conditions are met:
 *
 *     ==> Redistributions of source code must retain the above copyright notice,
 *         this list of conditions and the following disclaimer.
 *     ==> Redistributions in binary form must reproduce the above copyright notice,
 *         this list of conditions and the following disclaimer in the documentation
 *         and/or other materials provided with the distribution.
 *     ==> Neither the name of Qwertycoin nor the names of its contributors
 *         may be used to endorse or promote products derived from this software
 *          without specific prior written permission.
 *
 *     THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 *     "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 *     LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 *     A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 *     CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *     EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *     PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *     PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 *     LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *     NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 *     SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { scheduleOnRuntime, createWorkletRuntime } from 'react-native-worklets';

import {Wallet} from "./Wallet";
import {BlockchainExplorer, RawDaemon_Transaction} from "./blockchain/BlockchainExplorer";
import {Transaction, TransactionData, Deposit} from "./Transaction";
import {TransactionsExplorer} from "./TransactionsExplorer";
import { config } from "../config";
import { dependencyContainer } from "../services/DependencyContainer";
import { IWalletOperations } from "../services/interfaces/IWalletOperations";
import { CronBuddy } from "../services/CronBuddy";
import { getGlobalWorkletLogging } from '../services/interfaces/IWorkletLogging';


// Smart thread management with fallback for Expo Go compatibility
let ThreadManager: any = null;
let threadSupportAvailable = false;

try {
  ThreadManager = require('react-native-multithreading').ThreadManager;
  if (ThreadManager && typeof ThreadManager === 'function') {
    // Test actual thread creation to verify it works
    try {
      const testThread = ThreadManager.createThread('./workers/ParseTransactionsRN.ts');
      testThread.terminate(); // Clean up test thread
      threadSupportAvailable = true;
      console.log('WalletWatchdogRN: react-native-multithreading fully functional - multi-threading enabled');
    } catch (threadError) {
      console.log('WalletWatchdogRN: react-native-multithreading detected but thread creation fails - using single-threaded fallback');
      console.log('WalletWatchdogRN: Thread creation error:', threadError.message);
    }
  } else {
    console.log('WalletWatchdogRN: react-native-multithreading detected but not functional - using single-threaded fallback');
  }
} catch (error) {
  console.log('WalletWatchdogRN: react-native-multithreading not available - using single-threaded fallback');
}

interface IBlockRange {
  startBlock: number;
  endBlock: number;
  finished: boolean;
  timestamp: Date;
  transactions: RawDaemon_Transaction[];
}

interface ITxQueueItem {
  transactions: RawDaemon_Transaction[];
  maxBlockNum: number;
}

type ProcessingCallback = (blockNumber: number) => void;

/**
 * React Native adapted TxQueue using react-native-threads
 */
class TxQueueRN {
  private wallet: Wallet;
  private isReady: boolean;
  private isRunning: boolean;
  private countAdded: number;
  private workerProcess: any; // React Native thread instead of Web Worker
  private countProcessed: number;
  private processingQueue: ITxQueueItem[];
  private processingCallback: ProcessingCallback;

  constructor(wallet: Wallet, processingCallback: ProcessingCallback) {
    this.wallet = wallet;
    this.isReady = false;
    this.isRunning = false;
    this.countAdded = 0;
    this.countProcessed = 0;
    this.processingQueue = [];
    this.processingCallback = processingCallback;
    
    if (threadSupportAvailable) {
      this.workerProcess = this.initWorker();
    } else {
      // Fallback to synchronous processing
      this.isReady = true;
      getGlobalWorkletLogging().logging1string('TxQueueRN: Using synchronous fallback (no threads available)');
    }
  }

  initWorker = (): any => {
    if (!threadSupportAvailable) {
      return null;
    }

    try {
      this.workerProcess = ThreadManager.createThread('./workers/ParseTransactionsRN.ts');
      this.workerProcess.onmessage = (message: string) => {
        try {
          const data = typeof message === 'string' ? JSON.parse(message) : message;
          this.handleWorkerMessage(data);
        } catch (error) {
          console.error('TxQueueRN: Error parsing worker message:', error);
        }
      };
      return this.workerProcess;
    } catch (error) {
      console.error('TxQueueRN: Error creating worker thread:', error);
      this.isReady = true; // Fallback to synchronous
      return null;
    }
  }

  private handleWorkerMessage = (message: any): void => {
    if (message === 'ready') {
      getGlobalWorkletLogging().logging1string('TxQueueRN: Worker ready...');
      // Post the wallet to the worker
      this.workerProcess.postMessage(JSON.stringify({
        type: 'initWallet'
      }));
    } else if (message === "missing_wallet") {
      getGlobalWorkletLogging().logging1string("TxQueueRN: Wallet is missing for the worker...");
    } else if (message.type) {
      if (message.type === 'readyWallet') {
        this.setIsReady(true);
      } else if (message.type === 'processed') {
        if (message.transactions.length > 0) {
          for (let txData of message.transactions) {
            let txDataObject = TransactionData.fromRaw(txData);

            this.wallet.addNew(txDataObject.transaction);
            this.wallet.addDeposits(txDataObject.deposits);
            this.wallet.addWithdrawals(txDataObject.withdrawals);            
          }
          // Call janitor after adding transaction
          // Use dependency injection to avoid circular dependency
          const walletOperations = dependencyContainer.getWalletOperations();
          if (walletOperations) {
            walletOperations.janitor();
          }
          // Increase the number of transactions we actually added to wallet
          this.countAdded = this.countAdded + message.transactions.length;
        }

        // We processed all
        this.isRunning = false;
        // Signal progress and start next loop now
        this.processingCallback(message.maxHeight);
        this.runProcessLoop();
      } else if (message.type === 'error') {
        console.error('TxQueueRN: Worker error:', message.error);
        this.isRunning = false;
        this.processingCallback(0); // Continue with next item
        this.runProcessLoop();
      }
    }
  }

  runProcessLoop = (): void => {
    if (this.isReady) {
      // We destroy the worker in charge of decoding the transactions every 5k transactions to ensure the memory is not corrupted
      // cnUtil bug, see https://github.com/mymonero/mymonero-core-js/issues/8
      if (this.countProcessed >= 5 * 1000) {
        getGlobalWorkletLogging().logging1string('TxQueueRN: Recreating parseWorker for memory management...');
        this.restartWorker();
        setTimeout(() => {
          this.runProcessLoop();
        }, 1000);
        return;
      }

      if (!this.isRunning) {
        this.isRunning = true;
        // Dequeue one item from the processing queue and check if it's valid
        let txQueueItem: ITxQueueItem | null = this.processingQueue.shift()!;

        if (txQueueItem) {
          // Increase the number of transactions we actually processed
          this.countProcessed = this.countProcessed + txQueueItem.transactions.length;

          if (txQueueItem.transactions.length > 0) {
            if (threadSupportAvailable && this.workerProcess) {
              // Use worker thread
              this.workerProcess.postMessage(JSON.stringify({
                transactions: txQueueItem.transactions,
                maxBlock: txQueueItem.maxBlockNum,
                wallet: this.wallet.exportToRaw(),
                type: 'process'
              }));
            } else {
              // Synchronous fallback
              this.processTransactionsSync(txQueueItem.transactions, txQueueItem.maxBlockNum);
            }
          } else {
            this.isRunning = false;
            this.processingCallback(txQueueItem.maxBlockNum);
            this.runProcessLoop();
          }
        } else {
          this.isRunning = false;
        }
      }
    } else {
      if (!this.isReady) {
        setTimeout(() => {
          this.runProcessLoop();
        }, 1000);
      }
    }
  }

  private processTransactionsSync = (transactions: RawDaemon_Transaction[], maxBlockNum: number): void => {
    try {

      getGlobalWorkletLogging().loggingWithNumber(`TxQueueRN: Processing {} transactions synchronously`, transactions.length);
      //console.log(`TxQueueRN: Processing ${transactions.length} transactions synchronously`);
      
      for (const rawTx of transactions) {
        const txData = TransactionsExplorer.parse(rawTx, this.wallet);
        
        if (txData && txData.transaction) {
          this.wallet.addNew(txData.transaction);
          this.wallet.addDeposits(txData.deposits);
          this.wallet.addWithdrawals(txData.withdrawals);
        }
      }
      
      this.isRunning = false;
      this.processingCallback(maxBlockNum);
      this.runProcessLoop();
      
    } catch (error) {
      console.error('TxQueueRN: Error processing transactions synchronously:', error);
      this.isRunning = false;
      this.processingCallback(maxBlockNum);
      this.runProcessLoop();
    }
  }

  addTransactions = (transactions: RawDaemon_Transaction[], maxBlockNum: number) => {
    let txQueueItem: ITxQueueItem = {
      transactions: transactions,
      maxBlockNum: maxBlockNum
    }

    this.processingQueue.push(txQueueItem);
    this.runProcessLoop();
  }

  restartWorker = () => {
    this.isReady = false;
    this.isRunning = false;
    this.countProcessed = 0;
    
    if (this.workerProcess && threadSupportAvailable) {
      try {
        this.workerProcess.terminate();
      } catch (error) {
        console.error('TxQueueRN: Error terminating worker:', error);
      }
    }
    
    this.workerProcess = this.initWorker();
  }

  setIsReady = (value: boolean) => {
    this.isReady = value;
  }

  hasData = (): boolean => {
    return this.processingQueue.length > 0;
  }

  getSize = (): number => {
    return this.processingQueue.length;
  }

  reset = () => {
    this.isReady = false;
    this.isRunning = false;
    this.processingQueue = [];
    
    if (this.workerProcess && threadSupportAvailable) {
      try {
        this.workerProcess.terminate();
      } catch (error) {
        console.error('TxQueueRN: Error terminating worker during reset:', error);
      }
    }
    
    this.workerProcess = this.initWorker();
  }
}

/**
 * React Native adapted BlockList (unchanged from original)
 */
class BlockListRN {
  private blocks: IBlockRange[];
  private wallet: Wallet;
  private txQueue: TxQueueRN;
  private chainHeight: number;
  private watchdog: WalletWatchdogRN;

  constructor(wallet: Wallet, watchdog: WalletWatchdogRN) {
    this.blocks = [];
    this.wallet = wallet;
    this.chainHeight = 0;
    this.watchdog = watchdog;
    this.txQueue = new TxQueueRN(wallet, (blockNumber: number) => {
      this.wallet.lastHeight = Math.min(this.chainHeight, Math.max(this.wallet.lastHeight, blockNumber));
      this.watchdog.checkMempool();
      
      // Smart save mechanism: only save during big sync jobs
      if (this.watchdog.isBigSyncJob) {
        this.watchdog.blockCounter++;
        if (this.watchdog.blockCounter >= 5000) {
          this.watchdog.saveWallet('5000-block interval during big sync');
          this.watchdog.blockCounter = 0;
        }
      }
    });
  }

  addBlockRange = (startBlock: number, endBlock: number, chainHeight: number) => {
    this.chainHeight = Math.max(this.chainHeight, chainHeight);

    let rangeData: IBlockRange = {
      startBlock: startBlock,
      endBlock: endBlock,
      finished: false,
      timestamp: new Date(),
      transactions: []
    }

    if (this.blocks.length > 0) {
      for (var i = this.blocks.length - 1; i >= 0; i--) {
        if ((startBlock === this.blocks[i].startBlock) && (endBlock === this.blocks[i].endBlock)) {
          return;
        } else if (endBlock > this.blocks[i].endBlock) {
          if (i === this.blocks.length) {
            this.blocks.push(rangeData);
          } else {
            this.blocks.splice(i + 1, 0, rangeData);
          }
          break;
        }
      }
    } else {
      this.blocks.push(rangeData);
    }
  }

  finishBlockRange = (lastBlock: number, transactions: RawDaemon_Transaction[]) => {
    if (lastBlock > -1) {
      for (let i = 0; i < this.blocks.length; ++i) {
        if (lastBlock <= this.blocks[i].endBlock) {
          this.blocks[i].transactions = transactions;
          this.blocks[i].finished = true;
          break;
        }
      }

      // Remove all finished blocks
      while (this.blocks.length > 0) {
        if (this.blocks[0].finished) {
          let block = this.blocks.shift()!;
          // Add any transactions to the wallet
          this.txQueue.addTransactions(block.transactions, block.endBlock);
        } else {
          break;
        }
      }
    }
  }

  markIdleBlockRange = (lastBlock: number): boolean => {
    for (let i = 0; i < this.blocks.length; ++i) {
      if (this.blocks[i].endBlock === lastBlock) {
        this.blocks[i].timestamp = new Date(0);
        return true;
      }
    }
    return false;
  }

  getFirstIdleRange = (reset: boolean): IBlockRange | null => {
    for (let i = 0; i < this.blocks.length; ++i) {
      if (!this.blocks[i].finished) {
        let timeDiff: number = new Date().getTime() - this.blocks[i].timestamp.getTime();
        if ((timeDiff / 1000) > 30) {
          if (reset) { this.blocks[i].timestamp = new Date(); }
          return this.blocks[i];
        }
      } else {
        return null;
      }
    }
    return null;
  }

  getTxQueue = (): TxQueueRN => {
    return this.txQueue;
  }

  getBlocks = (): IBlockRange[] => {
    return this.blocks;
  }

  getSize = (): number => {
    return this.blocks.length;
  }

  reset = () => {
    this.blocks = [];
  }
}

type ParseTxCallback = () => void;

/**
 * React Native adapted ParseWorker using react-native-threads
 */
class ParseWorkerRN {
  private wallet: Wallet;
  private isReady: boolean;
  private watchdog: WalletWatchdogRN;
  private isWorking: boolean;
  private blockList: BlockListRN;
  private workerProcess: any; // React Native thread instead of Web Worker
  private countProcessed: number;
  private parseTxCallback: ParseTxCallback;

  constructor(wallet: Wallet, watchdog: WalletWatchdogRN, blockList: BlockListRN, parseTxCallback: ParseTxCallback) {
    this.parseTxCallback = parseTxCallback;
    this.blockList = blockList;
    this.watchdog = watchdog;
    this.wallet = wallet;

    this.countProcessed = 0;
    this.isWorking = false;
    this.isReady = false;
    
    if (threadSupportAvailable) {
      this.workerProcess = this.initWorker();
    } else {
      // Fallback to synchronous processing
      this.isReady = true;
      getGlobalWorkletLogging().logging1string('ParseWorkerRN: Using synchronous fallback (no threads available)');
    }
  }

  initWorker = (): any => {
    if (!threadSupportAvailable) {
      return null;
    }

    try {
      this.workerProcess = ThreadManager.createThread('./workers/TransferProcessingRN.ts');
      this.workerProcess.onmessage = (message: string) => {
        try {
          const data = typeof message === 'string' ? JSON.parse(message) : message;
          this.handleWorkerMessage(data);
        } catch (error) {
          console.error('ParseWorkerRN: Error parsing worker message:', error);
        }
      };
      return this.workerProcess;
    } catch (error) {
      console.error('ParseWorkerRN: Error creating worker thread:', error);
      this.isReady = true; // Fallback to synchronous
      return null;
    }
  }

  private handleWorkerMessage = (message: any): void => {
    if (message === 'ready') {
      getGlobalWorkletLogging().logging1string('ParseWorkerRN: Worker ready...');
      // Signal the wallet update
      this.watchdog.checkMempool();
      // Post the wallet to the worker
      this.workerProcess.postMessage(JSON.stringify({
        type: 'initWallet'
      }));
    } else if (message === "missing_wallet") {
      getGlobalWorkletLogging().logging1string("ParseWorkerRN: Wallet is missing for the worker...");
    } else if (message.type) {
      if (message.type === 'readyWallet') {
        this.setIsReady(true);
      } else if (message.type === 'processed') {
        // We are done processing now
        this.blockList.finishBlockRange(message.maxHeight, message.transactions);
        this.setIsWorking(false);
        this.parseTxCallback();
      } else if (message.type === 'error') {
        console.error('ParseWorkerRN: Worker error:', message.error);
        this.setIsWorking(false);
        this.parseTxCallback();
      }
    }
  }

  getWorker = (): any => {
    return this.workerProcess;
  }

  getIsReady = (): boolean => {
    return this.isReady;
  }

  getIsWorking = (): boolean => {
    return this.isWorking;
  }

  setIsReady = (value: boolean) => {
    this.isReady = value;
  }

  setIsWorking = (value: boolean) => {
    this.isWorking = value;
  }

  getProcessed = (): number => {
    return this.countProcessed;
  }

  incProcessed = (value: number) => {
    this.countProcessed = this.countProcessed + value;
  }
}

/**
 * SyncWorker (unchanged from original)
 */
class SyncWorkerRN {
  private wallet: Wallet;
  private isWorking: boolean;
  private explorer: BlockchainExplorer;

  constructor(explorer: BlockchainExplorer, wallet: Wallet) {
    this.wallet = wallet;
    this.isWorking = false;
    this.explorer = explorer;
  }

  fetchBlocks = (startBlock: number, endBlock: number): Promise<{transactions: RawDaemon_Transaction[], lastBlock: number}> => {
    this.isWorking = true;

    return new Promise<any>((resolve, reject) => {
      this.explorer.getTransactionsForBlocks(startBlock, endBlock, this.wallet.options.checkMinerTx).then((transactions: RawDaemon_Transaction[]) => {
        resolve({
          transactions: transactions,
          lastBlock: endBlock
        });
      }).catch((err) => {
        reject({
          transactions: [],
          lastBlock: endBlock
        });
      }).finally(() => {
        this.isWorking = false;
      });
    });
  }

  getIsWorking = (): boolean => {
    return this.isWorking;
  }
}

interface ITransacationQueue {
  transactions: RawDaemon_Transaction[];
  lastBlock: number;
}

/**
 * React Native adapted WalletWatchdog with thread allocation logic
 */
export class WalletWatchdogRN {
  private wallet: Wallet;
  private stopped: boolean = false;
  private blockList: BlockListRN;
  private cpuCores: number = 0;
  private maxCpuCores: number = 0;
  private remoteNodes: number = 0;
  private explorer: BlockchainExplorer;
  private syncWorkers: SyncWorkerRN[] = [];
  private parseWorkers: ParseWorkerRN[] = [];
  private intervalMempool: any = 0;
  private lastBlockLoading: number = -1;
  private lastMaximumHeight: number = 0;
  private transactionsToProcess: ITransacationQueue[] = [];

  // Thread management with Expo Go fallback
  private useThreads: boolean = false;
  private maxThreads: number = 4; // Default, will be updated by updateThreadAllocation

  // Smart save mechanism
  public blockCounter: number = 0;
  public isBigSyncJob: boolean = false; // true if currentHeight - lastHeight > 5000
  private bigSyncJob_threshold: number = 5000;

  constructor(wallet: Wallet, explorer: BlockchainExplorer) {
    console.log('WalletWatchdogRN: Initializing React Native adapted WalletWatchdog');
    
    // Detect thread availability
    this.useThreads = threadSupportAvailable;
    console.log(`WalletWatchdogRN: Thread support - ${this.useThreads ? 'ENABLED' : 'DISABLED (Expo Go fallback)'}`);
    
    // Use our thread allocation logic
    this.updateThreadAllocation();

    this.wallet = wallet;
    this.explorer = explorer;
    this.blockList = new BlockListRN(wallet, this);
    
    // Set global instance so BlockchainExplorerRPCDaemon can trigger saves
    (global as any).walletWatchdogInstance = this;

    // Create parse workers
    for (let i = 0; i < this.maxCpuCores; ++i) {
      let parseWorker: ParseWorkerRN = new ParseWorkerRN(this.wallet, this, this.blockList, this.processParseTransaction);
      this.parseWorkers.push(parseWorker);
    }

    // Create a worker for each random node
    for (let i = 0; i < config.nodeList.length; ++i) {
      this.syncWorkers.push(new SyncWorkerRN(this.explorer, this.wallet));
    }

    this.setupWorkers();
  }

  /**
   * Dynamically allocate threads using 2/3 of available cores
   * Re-evaluates available threads every call for optimal performance
   * Reserves 1 thread for main app UI/operations
   */
  private updateThreadAllocation = (): void => {
    // Use config value as the base, but cap it reasonably for mobile devices
    const estimatedCores = Math.min(8, config.maxWorkerCores); // Modern phones can have up to 8 cores
    const totalCores = estimatedCores;
    
    // Reserve 1 thread for main app, use 2/3 of remaining threads
    const availableForSync = totalCores - 1; // Reserve 1 for app
    this.maxCpuCores = Math.max(1, Math.floor((availableForSync * 2) / 3));
    
    // Ensure we don't exceed the maximum allowed
    this.maxCpuCores = Math.min(this.maxCpuCores, config.maxWorkerCores);
    
    // Update max threads for react-native-threads (if available)
    this.maxThreads = this.useThreads ? this.maxCpuCores : 1;
    
    scheduleOnRuntime(getGlobalWorkletLogging().runtime, (maxThreads: number, useThreads: boolean) => {
      console.log(`WalletWatchdogRN: Thread management - Max threads: ${maxThreads} (${useThreads ? 'multi-threaded' : 'single-threaded fallback'})`);
    }, this.maxThreads, this.useThreads);
    //console.log(`WalletWatchdogRN: Thread management - Max threads: ${this.maxThreads} (${this.useThreads ? 'multi-threaded' : 'single-threaded fallback'})`);
  }

  setupWorkers = () => {
    this.cpuCores = this.maxCpuCores;

    if (this.wallet.options.readSpeed == 10) {
      // Use 3/4 of the cores for fast syncing
      this.cpuCores = Math.min(Math.max(1, Math.floor(3 * (this.maxCpuCores / 4))), config.maxWorkerCores);
    } else if (this.wallet.options.readSpeed == 50) {
      // Use half of the cores for medium syncing
      this.cpuCores = Math.min(Math.max(1, Math.floor(this.maxCpuCores / 2)), config.maxWorkerCores);
    } else if (this.wallet.options.readSpeed == 100) {
      // Slowest, use only one core
      this.cpuCores = 1;
    }

    // Random nodes are dependent both on max nodes available as well as on number of cores we have available and performance settings
    this.remoteNodes = Math.min(config.maxRemoteNodes, config.nodeList.length, this.cpuCores);
    

    //console.log(`WalletWatchdogRN: Setup complete - CPU cores: ${this.cpuCores}, Remote nodes: ${this.remoteNodes}`);
  }

  signalWalletUpdate = () => {
    getGlobalWorkletLogging().logging1string('WalletWatchdogRN: Wallet update in progress');
    //console.log('WalletWatchdogRN: Wallet update in progress');

    // Reset the last block loading
    this.lastBlockLoading = -1; // Reset scanning
    this.checkMempool();
  }

  initMempool = (force: boolean = false) => {
    if (this.intervalMempool === 0 || force) {
      if (force && this.intervalMempool !== 0) {
        clearInterval(this.intervalMempool);
      }

      this.intervalMempool = setInterval(() => {
        this.checkMempool();
      }, config.avgBlockTime / 4 * 1000);
    }
    this.checkMempool();
  }

  acquireWorker = (): ParseWorkerRN | null => {
    let workingCount = 0;

    // First check if max worker usage is reached
    for (let i = 0; i < this.parseWorkers.length; ++i) {
      if (this.parseWorkers[i].getIsWorking()) {
        workingCount = workingCount + 1;
      }
    }

    if (workingCount < this.cpuCores) {
      for (let i = 0; i < this.parseWorkers.length; ++i) {
        if (!this.parseWorkers[i].getIsWorking() && this.parseWorkers[i].getIsReady()) {
          return this.parseWorkers[i];
        }
      }
    }

    return null;
  }

  stop = () => {
    this.transactionsToProcess = [];
    clearInterval(this.intervalMempool);
    this.blockList.getTxQueue().reset();
    this.blockList.reset();
    this.stopped = true;
  }

  start = () => {
    // Init the mempool
    this.initMempool();

    // Run main loop
    this.stopped = false;
    this.lastBlockLoading = -1;
    this.lastMaximumHeight = -1;
    this.startSyncLoop();
  }

  checkMempool = (): boolean => {
    
    scheduleOnRuntime(getGlobalWorkletLogging().runtime, (lastMaximumHeight: number, walletLastHeight: number) => {
      console.log("WalletWatchdogRN: checkMempool", lastMaximumHeight, walletLastHeight);
    }, this.lastMaximumHeight, this.wallet.lastHeight);
    //console.log("WalletWatchdogRN: checkMempool", this.lastMaximumHeight, this.wallet.lastHeight);

    if (((this.lastMaximumHeight - this.wallet.lastHeight) > 1) && (this.lastMaximumHeight > 0)) {
      return false;
    }

    this.wallet.clearMemTx();
    this.explorer.getTransactionPool().then((pool: any) => {
      if (typeof pool !== 'undefined') {
        for (let rawTx of pool) {
          let txData = TransactionsExplorer.parse(rawTx, this.wallet);

          if ((txData !== null) && (txData.transaction !== null)) {
            this.wallet.addNewMemTx(txData.transaction);
          }
        }
      }
    }).catch(err => {
      if (err) {
        console.error("WalletWatchdogRN: checkMempool error:", err);
      }
    });

    return true;
  }

  processParseTransaction = () => {
    if (this.transactionsToProcess.length > 0) {
      let parseWorker = this.acquireWorker();

      if (parseWorker) {
        // Define the transactions we need to process
        let transactionsToProcess: ITransacationQueue | null = this.transactionsToProcess.shift()!;

        if (transactionsToProcess) {
          parseWorker.setIsWorking(true);
          // Increase the number of transactions we actually processed
          parseWorker.incProcessed(transactionsToProcess.transactions.length);
          
          if (threadSupportAvailable && parseWorker.getWorker()) {
            // Use worker thread
            parseWorker.getWorker().postMessage(JSON.stringify({
              transactions: transactionsToProcess.transactions,
              readMinersTx: this.wallet.options.checkMinerTx,
              maxBlock: transactionsToProcess.lastBlock,
              wallet: this.wallet.exportToRaw(),
              type: 'process',
            }));
          } else {
            // Synchronous fallback
            this.processTransactionsSync(transactionsToProcess.transactions, transactionsToProcess.lastBlock);
            parseWorker.setIsWorking(false);
            this.processParseTransaction(); // Continue with next item
          }
        }
      }
    }
  }

  private processTransactionsSync = (transactions: RawDaemon_Transaction[], lastBlock: number): void => {
    try {
      scheduleOnRuntime(getGlobalWorkletLogging().runtime, (transactionsLength: number) => {
        console.log(`WalletWatchdogRN: Processing ${transactionsLength} transactions synchronously`);
      }, transactions.length);
      //console.log(`WalletWatchdogRN: Processing ${transactions.length} transactions synchronously`);
      
      for (const rawTx of transactions) {
        // Debug: Check if this transaction belongs to us
        const isOwned = TransactionsExplorer.ownsTx(rawTx, this.wallet);
        
        if (isOwned) {
          
          scheduleOnRuntime(getGlobalWorkletLogging().runtime, (height: number, hash: string) => {
            console.log(`WalletWatchdogRN: Found owned transaction at height ${height}, hash: ${hash}`);
          }, rawTx.height, rawTx.hash);
          //console.log(`WalletWatchdogRN: Found owned transaction at height ${rawTx.height}, hash: ${rawTx.hash}`);
          // Process the transaction
          const txData = TransactionsExplorer.parse(rawTx, this.wallet);
          if (txData && txData.transaction) {
            this.wallet.addNew(txData.transaction);
            this.wallet.addDeposits(txData.deposits);
            this.wallet.addWithdrawals(txData.withdrawals);
            scheduleOnRuntime(getGlobalWorkletLogging().runtime, (height: number) => {
              console.log(`WalletWatchdogRN: Successfully processed owned transaction at height ${height}`);
            }, rawTx.height);
            //console.log(`WalletWatchdogRN: Successfully processed owned transaction at height ${rawTx.height}`);
          }
        }
      }
      
        const walletOperations = dependencyContainer.getWalletOperations();
        if (walletOperations) {
          walletOperations.janitor();
        }
   
      
      // Finish the block range
      this.blockList.finishBlockRange(lastBlock, transactions);
      
    } catch (error) {
      console.error('WalletWatchdogRN: Error processing transactions synchronously:', error);
    }
  }

  processTransactions(transactions: RawDaemon_Transaction[], lastBlock: number) {
    let txList: ITransacationQueue = {
      transactions: transactions,
      lastBlock: lastBlock,
    }

    scheduleOnRuntime(getGlobalWorkletLogging().runtime, (transactionsLength: number) => {
      console.log(`WalletWatchdogRN: processTransactions called...`, transactionsLength, 'transactions');
    }, transactions.length);
    //console.log(`WalletWatchdogRN: processTransactions called...`, transactions.length, 'transactions');
    // Add the raw transaction to the processing FIFO list
    this.transactionsToProcess.push(txList);
    // Parse the transactions immediately
    this.processParseTransaction();
  }

  getMultipleRandom = (arr: any[], num: number) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, num);
  }

  getFreeWorker = (): SyncWorkerRN | null => {
    let workingCount = 0;

    // First check if max worker usage is reached
    for (let i = 0; i < this.syncWorkers.length; ++i) {
      if (this.syncWorkers[i].getIsWorking()) {
        workingCount = workingCount + 1;
      }
    }

    if (workingCount < this.remoteNodes) {
      for (let i = 0; i < this.syncWorkers.length; ++i) {
        if (!this.syncWorkers[i].getIsWorking()) {
          return this.syncWorkers[i];
        }
      }
    }

    return null;
  }

  getBlockList = (): BlockListRN => {
    return this.blockList;
  }

  getLastBlockLoading = (): number => {
    return this.lastBlockLoading;
  }

  getBlockchainHeight = (): number => {
    return this.lastMaximumHeight;
  }

  // Simple save method - delegates to WalletService.saveWallet() for consistency
  saveWallet = async (reason: string = 'manual save'): Promise<void> => {
    try {
      console.log('WalletWatchdogRN: Delegating save to WalletService:', reason);
      const walletOps = dependencyContainer.getWalletOperations();
      await walletOps.saveWallet(reason);
    } catch (error) {
      console.error('WalletWatchdogRN: Error saving wallet:', error);
    }
  }

  startSyncLoop = async () => {
    (async function(self) {
      while (!self.stopped) {
        try {
          // Re-evaluate thread allocation every loop iteration
          self.updateThreadAllocation();
          
          if (self.lastBlockLoading === -1) {
            self.lastBlockLoading = self.wallet.lastHeight;
            
            scheduleOnRuntime(getGlobalWorkletLogging().runtime, (lastBlockLoading: number, walletLastHeight: number, walletCreationHeight: number, walletAddress: string) => {
              console.log('WalletWatchdogRN: Starting synchronization from height:', {
                lastBlockLoading: lastBlockLoading,
                walletLastHeight: walletLastHeight,
                walletCreationHeight: walletCreationHeight,
                walletAddress: walletAddress
              });
            }, self.lastBlockLoading, self.wallet.lastHeight, self.wallet.creationHeight, self.wallet.getPublicAddress());
            /*console.log('WalletWatchdogRN: Starting synchronization from height:', {
              lastBlockLoading: self.lastBlockLoading,
              walletLastHeight: self.wallet.lastHeight,
              walletCreationHeight: self.wallet.creationHeight,
              walletAddress: self.wallet.getPublicAddress()
            });*/
          }

          // Check if transactions to process stack is too big
          if (self.transactionsToProcess.length > 500) {
            getGlobalWorkletLogging().logging1string1number(`WalletWatchdogRN: Having more than 500 TX packets in FIFO queue`, self.transactionsToProcess.length);
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }

          // Get the current height of the chain
          let height = await self.explorer.getHeight();
          
          scheduleOnRuntime(getGlobalWorkletLogging().runtime, (height: number, walletLastHeight: number, lastMaximumHeight: number) => {
            console.log('WalletWatchdogRN: Sync loop - blockchain height:', height, 'wallet lastHeight:', walletLastHeight, 'lastMaximumHeight:', lastMaximumHeight);
          }, height, self.wallet.lastHeight, self.lastMaximumHeight);
          //console.log('WalletWatchdogRN: Sync loop - blockchain height:', height, 'wallet lastHeight:', self.wallet.lastHeight, 'lastMaximumHeight:', self.lastMaximumHeight);

          // Make sure we are not ahead of chain
          if (self.lastBlockLoading > height) {
            self.lastBlockLoading = height;
          }

          // Determine if this is a big sync job (>5000 blocks behind)
          const blocksToSync = height - self.wallet.lastHeight;
          self.isBigSyncJob = blocksToSync > self.bigSyncJob_threshold;
          
          if (self.isBigSyncJob && self.blockCounter === 0) {
            
            scheduleOnRuntime(getGlobalWorkletLogging().runtime, (blocksToSync: number, walletLastHeight: number, blockchainHeight: number) => {
              console.log('WalletWatchdogRN: Big sync job detected - enabling 5000-block saves', {
                blocksToSync: blocksToSync,
                walletLastHeight: walletLastHeight,
                blockchainHeight: blockchainHeight
              });
            }, blocksToSync, self.wallet.lastHeight, height);
            /*console.log('WalletWatchdogRN: Big sync job detected - enabling 5000-block saves', {
              blocksToSync,
              walletLastHeight: self.wallet.lastHeight,
              blockchainHeight: height
            });*/
          } else if (!self.isBigSyncJob && self.blockCounter > 0) {
            
            scheduleOnRuntime(getGlobalWorkletLogging().runtime, (blocksToSync: number, walletLastHeight: number, blockchainHeight: number) => {
              console.log('WalletWatchdogRN: Small sync job - disabling counter saves', {
                blocksToSync: blocksToSync,
                walletLastHeight: walletLastHeight,
                blockchainHeight: blockchainHeight
              });
            }, blocksToSync, self.wallet.lastHeight, height);
            /*console.log('WalletWatchdogRN: Small sync job - disabling counter saves', {
              blocksToSync,
              walletLastHeight: self.wallet.lastHeight,
              blockchainHeight: height
            });*/
            self.blockCounter = 0; // Reset counter for small sync jobs
          }


          if (height > self.lastMaximumHeight) {
            self.lastMaximumHeight = height;
          } else {
            if (self.wallet.lastHeight >= self.lastMaximumHeight) {
              // Wallet is synced - start CronBuddy if not already started
              if (!CronBuddy.isActive()) {
                CronBuddy.start();
              }
              await new Promise(r => setTimeout(r, 1000));
              continue;
            } else {
              self.blockCounter = 0; // Reset counter for small sync jobs
            }
          }

          // Get a free worker and check if we have idle blocks first
          let freeWorker: SyncWorkerRN | null = self.getFreeWorker();
          
          scheduleOnRuntime(getGlobalWorkletLogging().runtime, (freeWorker: SyncWorkerRN | null) => {
            console.log('WalletWatchdogRN: Free worker available:', freeWorker !== null);
          }, freeWorker);
          //console.log('WalletWatchdogRN: Free worker available:', freeWorker !== null);

          if (freeWorker) {
            // First check if we have any stale ranges available
            let idleRange = self.blockList.getFirstIdleRange(true);
            let startBlock: number = 0;
            let endBlock: number = 0;

            if (idleRange) {
              startBlock = idleRange.startBlock;
              endBlock = idleRange.endBlock;
            } else if (self.lastBlockLoading < height) {
              // Check if block range list is too big
              if (self.blockList.getSize() >= config.maxBlockQueue) {
                
                scheduleOnRuntime(getGlobalWorkletLogging().runtime, (blockListSize: number) => {
                  console.log('WalletWatchdogRN: Block range list is too big', blockListSize);
                }, self.blockList.getSize());
                //console.log('WalletWatchdogRN: Block range list is too big', self.blockList.getSize());
                await new Promise(r => setTimeout(r, 500));
                continue;
              }

              startBlock = Math.max(0, Number(self.lastBlockLoading));
              endBlock = startBlock + config.syncBlockCount;
              // Make sure endBlock is not over current height
              endBlock = Math.min(endBlock, height + 1);

              if (startBlock > self.lastMaximumHeight) {
                startBlock = self.lastMaximumHeight;
              }

              // Add the blocks to be processed to the block list
              self.blockList.addBlockRange(startBlock, endBlock, height);
              self.lastBlockLoading = Math.max(self.lastBlockLoading, endBlock);
            } else {
              await new Promise(r => setTimeout(r, 10 * 1000));
              continue;
            }

            // Try to fetch the block range with a currently selected sync worker
            freeWorker.fetchBlocks(startBlock, endBlock).then((blockData: {transactions: RawDaemon_Transaction[], lastBlock: number}) => {
              if (blockData.transactions.length > 0) {
                self.processTransactions(blockData.transactions, blockData.lastBlock);
              } else {
                self.blockList.finishBlockRange(blockData.lastBlock, []);
              }
            }).catch((blockData: {transactions: RawDaemon_Transaction[], lastBlock: number}) => {
              self.blockList.markIdleBlockRange(blockData.lastBlock);
            });
          } else {
            await new Promise(r => setTimeout(r, 500));
          }
        } catch(err) {
          console.error(`WalletWatchdogRN: Error occurred in startSyncLoop...`, err);
          await new Promise(r => setTimeout(r, 30 * 1000)); // Retry 30s later if an error occurred
        }
      }
    })(this);
  }

  /**
   * Janitor - Perform maintenance tasks after processing a transaction that belongs to us
   * This is a pragmatic approach - instead of relying on observers, just do the maintenance directly
   */
  /*
  public janitor(): void {
    try {
      
      getGlobalWorkletLogging().logging1string('WalletWatchdogRN: Starting maintenance after transaction...');
      //console.log('WalletWatchdogRN: Starting maintenance after transaction...');
      
      // 1. Save wallet to storage (persist the new transaction)
      this.saveWallet('transaction processed');
      
      // 2. Trigger balance refresh directly via dependency injection
      // This is more reliable than the observer pattern
      const walletOperations = dependencyContainer.getWalletOperations();
      if (walletOperations) {
        walletOperations.triggerBalanceRefresh();
      }
      
      getGlobalWorkletLogging().logging1string('WalletWatchdogRN: Maintenance completed after transaction');
      //console.log('WalletWatchdogRN: Maintenance completed after transaction');
    } catch (error) {
      console.error('WalletWatchdogRN: Error during maintenance after transaction:', error);
    }
  }
    */
}
