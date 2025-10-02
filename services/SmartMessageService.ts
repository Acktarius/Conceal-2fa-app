/**
 * copyright (c) 2025, Acktarius
 * 
 * SmartMessageService - Handles smart message processing and localStorage updates
 * 
 * This service processes smart messages from blockchain transactions and updates
 * the local storage with the appropriate data (SharedKeys, etc.)
 */

import { SharedKey } from '../model/Transaction';
import { dependencyContainer } from './DependencyContainer';
import { IStorageService } from './interfaces/IStorageService';

export class SmartMessageService {
  
  /**
   * Handle smart message result and update localStorage
   */
  static async handleSmartMessageResult(data: any, smartMessage: any, transactionHash?: string): Promise<void> {
    try {
      if (smartMessage.command.startsWith('2FA,')) {
        const parts = smartMessage.command.split(',');
        const action = parts[1]; // 'c' for create, 'd' for delete

        if (action === 'c' && data.name && data.issuer && data.sharedKey) {
          // Create 2FA service
          await this.handle2FACreate(data, transactionHash);
        } else if (action === 'd' && data.hash) {
          // Delete 2FA service
          await this.handle2FADelete(data.hash, transactionHash);
        }
      }
    } catch (error) {
      console.error('SmartMessageService: Error handling smart message result:', error);
    }
  }

  /**
   * Handle 2FA delete from smart message
   */
  private static async handle2FADelete(hash: string, transactionHash?: string): Promise<void> {
    try {
      console.log('SmartMessageService: Processing 2FA delete for hash:', hash);
      
      const storageService = dependencyContainer.getStorageService();
      const existingSharedKeys = await storageService.getSharedKeys();
      
      // Find the shared key to delete by hash
      const sharedKeyToDelete = existingSharedKeys.find((sk: any) => sk.hash === hash);
      
      if (sharedKeyToDelete) {
        console.log('SmartMessageService: Found shared key to delete:', sharedKeyToDelete.name);
        
        // Update the shared key with revoke information
        // Keep the existing timeStampSharedKeyRevoke (set when user clicked delete)
        // Just clear the flags to confirm blockchain processing
        sharedKeyToDelete.revokeInQueue = false; // Clear revoke queue flag
        sharedKeyToDelete.toBePush = false; // Clear toBePush flag
        
        console.log('SmartMessageService: Updated shared key with revoke timestamp:', {
          name: sharedKeyToDelete.name,
          timeStampSharedKeyRevoke: sharedKeyToDelete.timeStampSharedKeyRevoke,
          revokeInQueue: sharedKeyToDelete.revokeInQueue,
          toBePush: sharedKeyToDelete.toBePush
        });
        
        // Save updated shared keys
        await storageService.saveSharedKeys(existingSharedKeys);
        console.log('SmartMessageService: Successfully processed 2FA delete for:', sharedKeyToDelete.name);
      } else {
        console.log('SmartMessageService: No shared key found with hash:', hash);
      }
    } catch (error) {
      console.error('SmartMessageService: Error processing 2FA delete:', error);
    }
  }

  /**
   * Handle 2FA create from smart message
   */
  private static async handle2FACreate(data: { name: string, issuer: string, sharedKey: string }, transactionHash?: string): Promise<void> {
    try {
      // Get existing shared keys from localStorage
      const storageService = dependencyContainer.getStorageService();
      const existingSharedKeys = await storageService.getSharedKeys();
      
      // 1. Check for existing shared key by hash first
      const existingByHash = existingSharedKeys.find((sk: any) => sk.hash === transactionHash);
      if (existingByHash) {
        console.log('SmartMessageService: 2FA service already exists by hash, updating isLocal to false:', data.name);
        // We know about this shared key, it's safe to update and set isLocal = false
        existingByHash.isLocal = false; // Now confirmed on blockchain
        
        // Save updated shared keys
        await storageService.saveSharedKeys(existingSharedKeys);
        console.log('SmartMessageService: Updated existing shared key with isLocal=false:', data.name);
        return;
      }

      // 2. Check for existing shared key by sharedKey (secret)
      const existingBySharedKey = existingSharedKeys.find((sk: any) => 
        sk.secret === data.sharedKey
      );
      if (existingBySharedKey) {
        console.log('SmartMessageService: 2FA service already exists by sharedKey, updating with hash:', data.name);
        // We know about this key, it's safe to import, update hash and isLocal=false
        existingBySharedKey.hash = transactionHash || 'blockchain-imported';
        existingBySharedKey.toBePush = false; // Safety: ensure toBePush is false
        existingBySharedKey.revokeInQueue = false; // Safety: ensure not in revoke queue
        existingBySharedKey.unknownSource = false; // Known source, trusted
        existingBySharedKey.isLocal = false; // Now confirmed on blockchain
        
        // Save updated shared keys
        await storageService.saveSharedKeys(existingSharedKeys);
        console.log('SmartMessageService: Updated existing shared key with hash:', data.name);
        return;
      }

      // 3. Shared key is unknown, import it but mark as unknown source
      console.log('SmartMessageService: Unknown 2FA service, importing with unknownSource flag:', data.name);
      
      // Create new SharedKey object from smart message data
      const newSharedKey = SharedKey.fromRaw({
        name: data.name,
        issuer: data.issuer,
        secret: data.sharedKey
      });

      // Set properties for blockchain-imported shared key
      newSharedKey.hash = transactionHash || 'blockchain-imported'; // Use actual transaction hash
      newSharedKey.toBePush = false; // Already on blockchain
      newSharedKey.revokeInQueue = false; // Not being revoked
      newSharedKey.unknownSource = true; // Unknown source, needs user verification
      newSharedKey.isLocal = false; // On blockchain

      // Add to localStorage
      const updatedSharedKeys = [...existingSharedKeys, newSharedKey];
      await storageService.saveSharedKeys(updatedSharedKeys);

      console.log('SmartMessageService: 2FA service imported with unknownSource flag:', data.name);
    } catch (error) {
      console.error('SmartMessageService: Error creating 2FA from smart message:', error);
    }
  }
}
