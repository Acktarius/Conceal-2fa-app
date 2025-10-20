/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 * 
 * This file is part of Conceal-2FA-App
 * 
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */
import type { Wallet } from '../model/Wallet';
import { CoinUri } from '../model/CoinUri';

export class ExportService {
  
  /**
   * Export wallet as QR code data string
   * Returns the URI string that can be encoded as QR code
   */
  static exportWalletAsQR(wallet: Wallet): string {
    try {
      // Check if wallet has keys (not local-only)
      if (wallet.isLocal()) {
        throw new Error('Cannot export local-only wallet. Please upgrade to blockchain wallet first.');
      }

      // Get wallet data
      const address = wallet.getPublicAddress();
      const spendKey = wallet.keys.priv.spend;
      const viewKey = wallet.keys.priv.view;
      const height = wallet.creationHeight || 0;

      if (!address || !spendKey || !viewKey) {
        throw new Error('Invalid wallet data for export');
      }

      // Create QR URI using CoinUri format
      const qrData = ExportService.createWalletURI(address, spendKey, viewKey, height);
      
      console.log('EXPORT: Generated QR data for wallet:', address);
      return qrData;
    } catch (error) {
      console.error('Error exporting wallet as QR:', error);
      throw error;
    }
  }

  /**
   * Create wallet URI using CoinUri.encodeWalletKeys
   * Format: conceal.{address}?spend_key={spendKey}&view_key={viewKey}&height={height}
   */
  private static createWalletURI(address: string, spendKey: string, viewKey: string, height: number): string {
    return CoinUri.encodeWalletKeys(address, spendKey, viewKey, height);
  }

  /**
   * Validate QR data format before export
   */
  static validateQRData(qrData: string): boolean {
    try {
      return CoinUri.isWalletValid(qrData);
    } catch (error) {
      return false;
    }
  }
}
