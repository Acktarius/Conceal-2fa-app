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

import { StorageService } from './StorageService';
import { IWalletOperations } from './interfaces/IWalletOperations';
import { dependencyContainer } from './DependencyContainer';
import { SharedKey } from '../model/Transaction';
import { SmartMessageParser } from '../model/SmartMessage';
import { config } from '../config';
import { JSBigInt } from '../lib/biginteger';

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
    if (this.isRunning) {
      console.log('CronBuddy: Already running');
      return;
    }

    // Default intervals if none provided
    const defaultIntervals = {
      'toBePushed': this.DEFAULT_INTERVAL,      // 15 seconds - check for keys to push
      'revokeQueue': 60000,    // 1 minute - check for keys to revoke
      'walletSync': 30000,      // 30 seconds - check wallet sync status
    };

    const jobIntervals = intervals || defaultIntervals;

    console.log('CronBuddy: Starting background job scheduler with intervals:', jobIntervals);
    this.isRunning = true;
    
    // Start each job with its specific interval
    for (const [jobName, interval] of Object.entries(jobIntervals)) {
      this.startJob(jobName, interval);
    }
    
    console.log('CronBuddy: Started successfully with', Object.keys(jobIntervals).length, 'jobs');
  }

  /**
   * Start a specific job with its interval
   */
  private static startJob(jobName: string, interval: number): void {
    console.log(`CronBuddy: Starting job '${jobName}' with ${interval}ms interval`);
    
    // Run initial check
    this.runJob(jobName);
    
    // Set up interval for periodic checks
    const intervalId = setInterval(() => {
      this.runJob(jobName);
    }, interval);
    
    this.intervalIds.set(jobName, intervalId);
  }

  /**
   * Dynamically adjust the interval for a specific job
   */
  private static adjustJobInterval(jobName: string, newInterval: number): void {
    const existingIntervalId = this.intervalIds.get(jobName);
    if (existingIntervalId) {
      clearInterval(existingIntervalId);
      console.log(`CronBuddy: Adjusted '${jobName}' interval to ${newInterval}ms`);
      
      // Set up new interval
      const newIntervalId = setInterval(() => {
        this.runJob(jobName);
      }, newInterval);
      
      this.intervalIds.set(jobName, newIntervalId);
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
          await this.checkToBePushed();
          break;
        case 'revokeQueue':
          await this.checkRevokeQueue();
          break;
        case 'walletSync':
          await this.checkWalletSync();
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
    if (!this.isRunning) {
      console.log('CronBuddy: Not running');
      return;
    }

    console.log('CronBuddy: Stopping background job scheduler (wallet downgraded to local-only)');
    this.isRunning = false;
    
    // Clear all intervals
    for (const [jobName, intervalId] of this.intervalIds) {
      clearInterval(intervalId);
      console.log(`CronBuddy: Stopped job '${jobName}'`);
    }
    this.intervalIds.clear();
  }

  /**
   * Check if CronBuddy is running
   */
  static isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Force run a specific job immediately (for debugging)
   */
  static async forceCheck(jobName?: string): Promise<void> {
    if (jobName) {
      console.log(`CronBuddy: Force check requested for job '${jobName}'`);
      await this.runJob(jobName);
    } else {
      console.log('CronBuddy: Force check requested for all jobs');
      await Promise.all([
        this.checkToBePushed(),
        this.checkRevokeQueue(),
        this.checkWalletSync()
      ]);
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
      if (walletOperations.isWalletLocal()) {
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
      if (walletOperations.isWalletLocal()) {
        return;
      }

      // Check wallet sync status
      const syncStatus = walletOperations.getWalletSyncStatus();
      if (!syncStatus.isWalletSynced) {
        return;
      }

      // Check wallet balance (wallet.amount is number, convert to JSBigInt for comparison)
      const walletAmountBigInt = new JSBigInt(walletOperations.getWalletBalance().toString());
      if (walletAmountBigInt.compare(this.MIN_BALANCE_ATOMIC) < 0) {
        console.log('CronBuddy: Insufficient balance, skipping toBePushed check');
        return;
      }

      const sharedKeys = await StorageService.getSharedKeys();
      
      // Find the FIRST key that needs to be pushed
      const keyToPush = sharedKeys.find(key => key.toBePush === true);
      
      if (!keyToPush) {
        // No keys to push - adjust interval back to default
        this.adjustJobInterval('toBePushed', this.DEFAULT_INTERVAL);
        return;
      }

      // Found a key to push - adjust interval to busy mode
      this.adjustJobInterval('toBePushed', this.BUSY_INTERVAL);

      try {
        // CRITICAL: Set toBePush = false IMMEDIATELY to prevent retry loops
        // This prevents CronBuddy from retrying the same transaction every 2 minutes
        // while waiting for blockchain confirmation
        keyToPush.toBePush = false;
        await StorageService.saveSharedKeys(sharedKeys);
        
        // Send smart message to blockchain
        const result = await walletOperations.sendSmartMessage('create', keyToPush);
        
        if (result.success) {
          // Transaction was sent successfully
          keyToPush.toBePush = false;
          
          // Save again after successful transaction to persist the hash and toBePush=false
          await StorageService.saveSharedKeys(sharedKeys);
        } else {
          console.error(`CronBuddy: Failed to push shared key: ${keyToPush.name}`);
          // Re-enable toBePush for retry on next cycle
          keyToPush.toBePush = true;
          await StorageService.saveSharedKeys(sharedKeys);
        }
        
      } catch (error) {
        console.error(`CronBuddy: Error pushing shared key ${keyToPush.name}:`, error);
        
        // Re-enable toBePush for retry on next cycle
        keyToPush.toBePush = true;
        await StorageService.saveSharedKeys(sharedKeys);
        
        // Check if it's a blockchain transaction error
        if (error.message && error.message.includes('Failed to send raw transaction')) {
          console.error(`CronBuddy: Blockchain transaction failed for ${keyToPush.name}. This may be due to network issues or insufficient balance.`);
          // Will retry on next cycle since toBePush is re-enabled
        } else {
          console.error(`CronBuddy: Non-blockchain error for ${keyToPush.name}:`, error.message);
        }
      }

    } catch (error) {
      console.error('CronBuddy: Error checking toBePushed:', error);
    }
  }

  /**
   * Check for shared keys that need to be revoked from blockchain
   */
  private static async checkRevokeQueue(): Promise<void> {
    try {
      
      const sharedKeys = await StorageService.getSharedKeys();
      const keysToRevoke = sharedKeys.filter(key => key.revokeInQueue === true);
      
      if (keysToRevoke.length === 0) {
        console.log('CronBuddy: No shared keys to revoke');
        return;
      }

      console.log(`CronBuddy: Found ${keysToRevoke.length} shared keys to revoke`);

      for (const sharedKey of keysToRevoke) {
        try {
          if (!sharedKey.hash) {
            console.error(`CronBuddy: Cannot revoke shared key without hash: ${sharedKey.name}`);
            continue;
          }

          console.log(`CronBuddy: Revoking shared key: ${sharedKey.name} (${sharedKey.hash})`);
          
          // Send smart message to blockchain
          const walletOperations = dependencyContainer.getWalletOperations();
          if (!walletOperations) {
            console.error(`CronBuddy: Cannot revoke shared key - wallet operations not available: ${sharedKey.name}`);
            continue;
          }
          const result = await walletOperations.sendSmartMessage('delete', sharedKey);
          
          if (result.success) {
            // Remove shared key from local storage
            const updatedKeys = sharedKeys.filter(key => key !== sharedKey);
            await StorageService.saveSharedKeys(updatedKeys);
            
            console.log(`CronBuddy: Successfully revoked shared key: ${sharedKey.name}`);
            console.log(`CronBuddy: Delete transaction hash: ${result.txHash}`);
          } else {
            console.error(`CronBuddy: Failed to revoke shared key: ${sharedKey.name}`);
            console.log(`CronBuddy: Delete transaction may be pending, hash: ${result.txHash}`);
          }
        } catch (error) {
          console.error(`CronBuddy: Error revoking shared key ${sharedKey.name}:`, error);
        }
      }

    } catch (error) {
      console.error('CronBuddy: Error checking revokeQueue:', error);
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
      'toBePushed': this.DEFAULT_INTERVAL, // Will be dynamically adjusted
      'revokeQueue': 60000,
      'walletSync': 30000
    };

    for (const [jobName, interval] of Object.entries(defaultIntervals)) {
      jobs[jobName] = {
        interval,
        nextCheck: new Date(Date.now() + interval)
      };
    }

    return {
      isRunning: this.isRunning,
      jobs
    };
  }
}

export default CronBuddy;
