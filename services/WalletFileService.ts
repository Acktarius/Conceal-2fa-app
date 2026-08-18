/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */

import { type RawFullyEncryptedWallet, type RawWallet, Wallet } from '../model/Wallet';
import { WalletEnvelopeCodec } from './WalletEnvelopeCodec';

/** Export success — what the encrypted JSON contains. */
export const WALLET_FILE_EXPORT_NOTE =
  'Backup includes wallet keys, transactions, sync height, and custom node preference when set (same as next-wallet options). 2FA tiles are rebuilt from smart messages in the transaction history on import.';

/** Import success — full restore including 2FA replay when message txs are present. */
export const WALLET_FILE_IMPORT_NOTE =
  'Wallet restored from backup (keys, transactions, and balance). 2FA tiles were rebuilt from smart messages in the backup when present; otherwise scan or re-add services.';

export type WalletFileDecryptResult = {
  wallet: Wallet;
  raw: RawWallet;
};

/** File export/import via conceal-wallet-sdk envelope format. */
export class WalletFileService {
  static buildExportFilename(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `2fa-wallet-${year}-${month}-${day}-${hours}${minutes}${seconds}.json`;
  }

  static createEncryptedEnvelope(wallet: Wallet, password: string): RawFullyEncryptedWallet {
    if (wallet.isLocal()) {
      throw new Error('Cannot export local-only wallet. Please upgrade to blockchain wallet first.');
    }
    if (!password) {
      throw new Error('Export password is required');
    }
    return WalletEnvelopeCodec.saveEncryptedWallet(wallet.exportToRaw(), password);
  }

  static createExportFileContent(wallet: Wallet, password: string): string {
    const envelope = WalletFileService.createEncryptedEnvelope(wallet, password);
    return JSON.stringify(envelope);
  }

  static parseEncryptedWalletFile(content: string): RawFullyEncryptedWallet {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('Invalid wallet file: not valid JSON');
    }

    if (!WalletFileService.isEncryptedEnvelope(parsed)) {
      throw new Error('Invalid wallet file: missing encrypted wallet data');
    }

    return parsed;
  }

  static decryptWalletFromFile(envelope: RawFullyEncryptedWallet, password: string): Wallet | null {
    const result = WalletFileService.decryptWalletImport(envelope, password);
    return result?.wallet ?? null;
  }

  static decryptWalletImport(envelope: RawFullyEncryptedWallet, password: string): WalletFileDecryptResult | null {
    if (!password) {
      return null;
    }
    const raw = WalletEnvelopeCodec.decryptEnvelopeToRaw(envelope, password);
    if (raw === null) {
      return null;
    }
    return { wallet: Wallet.loadFromRaw(raw), raw };
  }

  private static isEncryptedEnvelope(value: unknown): value is RawFullyEncryptedWallet {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value as Partial<RawFullyEncryptedWallet>;
    return Array.isArray(candidate.data) && typeof candidate.nonce === 'string';
  }
}
