/**
 * Copyright (c) 2025, Acktarius
 *
 * CronBuddy - Background Job Scheduler for SmartMessage System
 *
 * This service runs periodic tasks to:
 * - Check for shared keys that need to be pushed to blockchain
 * - Check for shared keys that need to be revoked from blockchain
 *
 * Note: Smart message processing is handled by TransactionsExplorer during transaction parsing
 *
 * Start triggers:
 *   - When wallet goes from isLocal=true to isLocal=false
 *   - When wallet is isLocal=false and receives wallet sync status
 * Stop trigger: When wallet goes from isLocal=false to isLocal=true
 */

import { config } from '../config';
import { JSBigInt } from '../lib/biginteger';
import { dependencyContainer } from './DependencyContainer';
import { getGlobalWorkletLogging } from './interfaces/IWorkletLogging';

export class CronBuddy {
  private static isRunning: boolean = false;
  private static intervalIds: Map<string, NodeJS.Timeout> = new Map();
  private static readonly DEFAULT_INTERVAL = 60000; // 1 minute
  private static readonly BUSY_INTERVAL = 120000; // 2 minutes when processing keys
  private static readonly MIN_BALANCE_ATOMIC = config.coinFee.add(config.remoteNodeFee).add(config.messageTxAmount); // Minimum balance in atomic units

  /**
   * Start the CronBuddy service with custom intervals
   * @param intervals - Object with job names and their intervals in milliseconds
   * Example: { 'toBePushed': 60000, 'revokeQueue': 300000, 'walletSync': 30000 }
   */
  static start(intervals?: { [jobName: string]: number }): void {
    if (CronBuddy.isRunning) {
      getGlobalWorkletLogging().logging1string('CronBuddy: Already running');
      return;
    }

    // Default intervals if none provided
    const defaultIntervals = {
      toBePushed: CronBuddy.DEFAULT_INTERVAL, // 15 seconds - check for keys to push
      revokeQueue: 60000, // 1 minute - check for keys to revoke
      walletSync: 30000, // 30 seconds - check wallet sync status
    };

    const jobIntervals = intervals || defaultIntervals;

    console.log('CronBuddy: Starting background job scheduler with intervals:', jobIntervals);
    CronBuddy.isRunning = true;

    // Start each job with its specific interval
    for (const [jobName, interval] of Object.entries(jobIntervals)) {
      CronBuddy.startJob(jobName, interval);
    }

    getGlobalWorkletLogging().loggingWithNumber('CronBuddy: Started successfully with {} jobs', Object.keys(jobIntervals).length);
  }

  /**
   * Start a specific job with its interval
   */
  private static startJob(jobName: string, interval: number): void {
    getGlobalWorkletLogging().loggingWith_s_d(`CronBuddy: Starting job %s with %dms interval`, jobName, interval);

    // Run initial check
    CronBuddy.runJob(jobName);

    // Set up interval for periodic checks
    const intervalId = setInterval(() => {
      CronBuddy.runJob(jobName);
    }, interval);

    CronBuddy.intervalIds.set(jobName, intervalId);
  }

  /**
   * Dynamically adjust the interval for a specific job
   */
  private static adjustJobInterval(jobName: string, newInterval: number): void {
    const existingIntervalId = CronBuddy.intervalIds.get(jobName);
    if (existingIntervalId) {
      clearInterval(existingIntervalId);
      getGlobalWorkletLogging().loggingWith_s_d(`CronBuddy: Adjusted %s interval to %dms`, jobName, newInterval);

      // Set up new interval
      const newIntervalId = setInterval(() => {
        CronBuddy.runJob(jobName);
      }, newInterval);

      CronBuddy.intervalIds.set(jobName, newIntervalId);
    }
  }

  /**
   * Run a specific job
   */
  private static async runJob(jobName: string): Promise<void> {
    try {
      console.log(`CronBuddy: Running job '${jobName}' at ${new Date().toISOString()}`);

      switch (jobName) {
        case 'toBePushed':
          await CronBuddy.checkToBePushed();
          break;
        case 'revokeQueue':
          await CronBuddy.checkRevokeQueue();
          break;
        case 'walletSync':
          await CronBuddy.checkWalletSync();
          break;
        default:
          console.warn(`CronBuddy: Unknown job '${jobName}'`);
      }
    } catch (error) {
      console.error(`CronBuddy: Error running job '${jobName}':`, error);
    }
  }

  /**
   * Stop the CronBuddy service
   * Should be triggered when wallet goes from isLocal=false to isLocal=true
   */
  static stop(): void {
    if (!CronBuddy.isRunning) {
      getGlobalWorkletLogging().logging1string('CronBuddy: Not running');
      return;
    }

    getGlobalWorkletLogging().logging1string('CronBuddy: Stopping background job scheduler (wallet downgraded to local-only)');
    CronBuddy.isRunning = false;

    // Clear all intervals
    for (const [jobName, intervalId] of CronBuddy.intervalIds) {
      clearInterval(intervalId);
      getGlobalWorkletLogging().loggingWithString(`CronBuddy: Stopped job {}`, jobName);
    }
    CronBuddy.intervalIds.clear();
  }

  /**
   * Check if CronBuddy is running
   */
  static isActive(): boolean {
    return CronBuddy.isRunning;
  }

  /**
   * Force run a specific job immediately (for debugging)
   */
  static async forceCheck(jobName?: string): Promise<void> {
    if (jobName) {
      getGlobalWorkletLogging().loggingWithString(`CronBuddy: Force check requested for job {}`, jobName);
      await CronBuddy.runJob(jobName);
    } else {
      getGlobalWorkletLogging().logging1string('CronBuddy: Force check requested for all jobs');
      await Promise.all([CronBuddy.checkToBePushed(), CronBuddy.checkRevokeQueue(), CronBuddy.checkWalletSync()]);
    }
  }

  /**
   * Check wallet sync status (blockchain wallets only)
   */
  private static async checkWalletSync(): Promise<void> {
    try {
      const walletOperations = dependencyContainer.getWalletOperations();
      if (!walletOperations) {
        return;
      }

      // Check if wallet is local-only
      if (await walletOperations.isWalletLocal()) {
        return;
      }

      const syncStatus = walletOperations.getWalletSyncStatus();
      if (!syncStatus.isWalletSynced) {
        return;
      }
    } catch (error) {
      console.error('CronBuddy: Error checking wallet sync:', error);
    }
  }

  /**
   * Check for shared keys that need to be pushed to blockchain
   * Process only ONE key at a time and adjust interval dynamically
   */
  private static async checkToBePushed(): Promise<void> {
    try {
      // Check if wallet operations are available
      const walletOperations = dependencyContainer.getWalletOperations();
      if (!walletOperations) {
        return;
      }

      // Check if wallet is local-only
      if (await walletOperations.isWalletLocal()) {
        return;
      }

      // Check wallet sync status
      const syncStatus = walletOperations.getWalletSyncStatus();
      if (!syncStatus.isWalletSynced) {
        return;
      }

      // Check wallet balance (wallet.amount is number, convert to JSBigInt for comparison)
      const walletAmountBigInt = new JSBigInt(walletOperations.getWalletBalance().toString());
      if (walletAmountBigInt.compare(CronBuddy.MIN_BALANCE_ATOMIC) < 0) {
        getGlobalWorkletLogging().logging1string('CronBuddy: Insufficient balance, skipping toBePushed check');
        return;
      }

      const storageService = dependencyContainer.getStorageService();
      const sharedKeys = await storageService.getSharedKeys();

      // Find the FIRST key that needs to be pushed
      const keyToPush = sharedKeys.find((key) => key.toBePush === true);

      if (!keyToPush) {
        // No keys to push - adjust interval back to default
        CronBuddy.adjustJobInterval('toBePushed', CronBuddy.DEFAULT_INTERVAL);
        return;
      }

      // Found a key to push - adjust interval to busy mode
      CronBuddy.adjustJobInterval('toBePushed', CronBuddy.BUSY_INTERVAL);

      try {
        // CRITICAL: Set toBePush = false IMMEDIATELY to prevent retry loops
        // This prevents CronBuddy from retrying the same transaction every 2 minutes
        // while waiting for blockchain confirmation
        keyToPush.toBePush = false;
        await storageService.saveSharedKeys(sharedKeys);

        // Send smart message to blockchain
        const result = await walletOperations.sendSmartMessage('create', keyToPush);

        if (result.success) {
          // Transaction was sent successfully
          keyToPush.toBePush = false;

          // Save again after successful transaction to persist the hash and toBePush=false
          await storageService.saveSharedKeys(sharedKeys);
        } else {
          console.error(`CronBuddy: Failed to push shared key: ${keyToPush.name}`);
          // Re-enable toBePush for retry on next cycle
          keyToPush.toBePush = true;
          await storageService.saveSharedKeys(sharedKeys);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`CronBuddy: Error pushing ${keyToPush.name}:`, errorMessage);

        // Re-enable toBePush for retry on next cycle
        keyToPush.toBePush = true;
        await storageService.saveSharedKeys(sharedKeys);
      }
    } catch (error) {
      console.error('CronBuddy: Error checking toBePushed:', error);
    }
  }

  /**
   * Check for shared keys that need to be revoked from blockchain
   * Process only ONE key at a time and adjust interval dynamically
   */
  private static async checkRevokeQueue(): Promise<void> {
    try {
      getGlobalWorkletLogging().logging1string('CronBuddy: checkRevokeQueue() started');

      // Check if wallet operations are available
      const walletOperations = dependencyContainer.getWalletOperations();
      if (!walletOperations) {
        getGlobalWorkletLogging().logging1string('CronBuddy: No wallet operations available, skipping revokeQueue check');
        return;
      }

      // Check if wallet is local-only
      if (await walletOperations.isWalletLocal()) {
        getGlobalWorkletLogging().logging1string('CronBuddy: Wallet is local-only, skipping revokeQueue check');
        return;
      }

      // Check wallet sync status
      const syncStatus = walletOperations.getWalletSyncStatus();
      if (!syncStatus.isWalletSynced) {
        getGlobalWorkletLogging().logging1string('CronBuddy: Wallet not synced, skipping revokeQueue check');
        return;
      }

      // Check wallet balance (wallet.amount is number, convert to JSBigInt for comparison)
      const walletAmountBigInt = new JSBigInt(walletOperations.getWalletBalance().toString());
      if (walletAmountBigInt.compare(CronBuddy.MIN_BALANCE_ATOMIC) < 0) {
        getGlobalWorkletLogging().logging1string('CronBuddy: Insufficient balance, skipping revokeQueue check');
        return;
      }

      getGlobalWorkletLogging().logging1string('CronBuddy: All safety checks passed, proceeding with revokeQueue check');

      const storageService = dependencyContainer.getStorageService();
      const sharedKeys = await storageService.getSharedKeys();

      getGlobalWorkletLogging().loggingWithNumber(`CronBuddy: Retrieved shared keys: {}`, sharedKeys.length);
      const revokeKeys = sharedKeys.filter((key) => key.revokeInQueue === true);
      getGlobalWorkletLogging().loggingWithNumber(`CronBuddy: Found keys with revokeInQueue=true: {}`, revokeKeys.length);

      // Find the FIRST key that needs to be revoked
      const keyToRevoke = sharedKeys.find((key) => key.revokeInQueue === true);

      if (!keyToRevoke) {
        // No keys to revoke - adjust interval back to default
        CronBuddy.adjustJobInterval('revokeQueue', CronBuddy.DEFAULT_INTERVAL);
        return;
      }

      // Found a key to revoke - adjust interval to busy mode
      CronBuddy.adjustJobInterval('revokeQueue', CronBuddy.BUSY_INTERVAL);

      try {
        if (!keyToRevoke.hash) {
          getGlobalWorkletLogging().loggingWithString(`CronBuddy: Cannot revoke shared key without hash: {}`, keyToRevoke.name);
          // Remove from revoke queue since it can't be processed
          keyToRevoke.revokeInQueue = false;
          await storageService.saveSharedKeys(sharedKeys);
          return;
        }

        getGlobalWorkletLogging().loggingWithString(`CronBuddy: Revoking shared key: {}`, keyToRevoke.name);

        // CRITICAL: Set revokeInQueue = false IMMEDIATELY to prevent retry loops
        // This prevents CronBuddy from retrying the same transaction every 2 minutes
        // while waiting for blockchain confirmation
        keyToRevoke.revokeInQueue = false;
        await storageService.saveSharedKeys(sharedKeys);

        // Send smart message to blockchain
        const result = await walletOperations.sendSmartMessage('delete', keyToRevoke);

        if (result.success) {
          // Transaction was sent successfully
          getGlobalWorkletLogging().loggingWithString(`CronBuddy: Successfully sent revoke transaction for: {}`, keyToRevoke.name);
          getGlobalWorkletLogging().loggingWithString(`CronBuddy: Delete transaction hash: {}`, result.txHash);
        } else {
          console.error(`CronBuddy: Failed to revoke shared key: ${keyToRevoke.name}`);
          // Re-enable revokeInQueue for retry on next cycle
          keyToRevoke.revokeInQueue = true;
          await storageService.saveSharedKeys(sharedKeys);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`CronBuddy: Error revoking ${keyToRevoke.name}:`, errorMessage);

        // Re-enable revokeInQueue for retry on next cycle
        keyToRevoke.revokeInQueue = true;
        await storageService.saveSharedKeys(sharedKeys);
      }
    } catch (error) {
      console.error('CronBuddy: Error checking revokeQueue:', error);
      if (error instanceof Error) {
        console.error('CronBuddy: Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      }
    }
  }

  /**
   * Get CronBuddy status information
   */
  static getStatus(): {
    isRunning: boolean;
    jobs: { [jobName: string]: { interval: number; nextCheck: Date } };
  } {
    const jobs: { [jobName: string]: { interval: number; nextCheck: Date } } = {};

    // Default intervals for status display
    const defaultIntervals = {
      toBePushed: CronBuddy.DEFAULT_INTERVAL, // Will be dynamically adjusted
      revokeQueue: 60000,
      walletSync: 30000,
    };

    for (const [jobName, interval] of Object.entries(defaultIntervals)) {
      jobs[jobName] = {
        interval,
        nextCheck: new Date(Date.now() + interval),
      };
    }

    return {
      isRunning: CronBuddy.isRunning,
      jobs,
    };
  }
}

export default CronBuddy;
