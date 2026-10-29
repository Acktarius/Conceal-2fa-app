/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */

import { type RawFullyEncryptedWallet, type RawWallet, Wallet } from '../model/Wallet';
import { type Envelope3, UnsupportedWalletEnvelopeError, WalletEnvelopeCodec } from './WalletEnvelopeCodec';

/** Export success — what the encrypted JSON contains. */
export const WALLET_FILE_EXPORT_NOTE =
  'Backup includes wallet keys, transactions, sync height, and custom node preference when set (same as next-wallet options). 2FA tiles are rebuilt from smart messages in the transaction history on import.';

/** Import success — full restore including 2FA replay when message txs are present. */
export const WALLET_FILE_IMPORT_NOTE =
  'Wallet restored from backup (keys, transactions, and balance). 2FA tiles were rebuilt from smart messages in the backup when present; otherwise scan or re-add services.';

/** Ciphertext byte cap. JSON chars are 4× that; raw text is 4× the JSON cap. */
const MAX_ENVELOPE_CIPHERTEXT_BYTES = 8_388_608;
const MAX_ENVELOPE_JSON_CHARS = 4 * MAX_ENVELOPE_CIPHERTEXT_BYTES;
const MAX_ENVELOPE_TEXT_CHARS = 4 * MAX_ENVELOPE_JSON_CHARS;

/** Picked file or envelope text exceeds a size cap. Distinct from invalid JSON and a wrong password. */
export class WalletFileTooLargeError extends Error {
  readonly code = 'wallet-file-too-large' as const;
  constructor() {
    super('Wallet file is too large');
    this.name = 'WalletFileTooLargeError';
  }
}

export type WalletFileDecryptResult = {
  wallet: Wallet;
  raw: RawWallet;
};

function exceedsJsonChars(text: string, max: number): boolean {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c !== 0x20 && c !== 0x0a && c !== 0x0d && c !== 0x09 && ++count > max) {
      return true;
    }
  }
  return false;
}

function assertCiphertextLength(data: unknown): void {
  if (Array.isArray(data) && data.length > MAX_ENVELOPE_CIPHERTEXT_BYTES) {
    throw new WalletFileTooLargeError();
  }
}

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

  /** Pretty Envelope 3 header with ciphertext `data` on one line. */
  static stringifyEncryptedWallet(envelope: Envelope3): string {
    const { data, ...header } = envelope;
    const head = JSON.stringify(header, null, 2).slice(0, -2);
    return `${head},\n  "data": ${JSON.stringify(data)}\n}\n`;
  }

  static async createEncryptedEnvelope(wallet: Wallet, password: string): Promise<Envelope3> {
    if (wallet.isLocal()) {
      throw new Error('Cannot export local-only wallet. Please upgrade to blockchain wallet first.');
    }
    if (!password) {
      throw new Error('Export password is required');
    }
    const envelope = await WalletEnvelopeCodec.saveEncryptedWallet(wallet.exportToRaw(), password);
    assertCiphertextLength(envelope.data);
    return envelope;
  }

  static async createExportFileContent(wallet: Wallet, password: string): Promise<string> {
    const envelope = await WalletFileService.createEncryptedEnvelope(wallet, password);
    const opened = await WalletEnvelopeCodec.openEncryptedWallet(envelope, password);
    if (!WalletFileService.reopenMatches(opened, wallet.exportToRaw())) {
      throw new Error('Wallet backup could not be verified');
    }
    return WalletFileService.stringifyEncryptedWallet(envelope);
  }

  static parseEncryptedWalletFile(content: string): RawFullyEncryptedWallet {
    if (typeof content !== 'string' || content.length > MAX_ENVELOPE_TEXT_CHARS) {
      throw new WalletFileTooLargeError();
    }
    const body = content.replace(/^\uFEFF/, '').trim();
    if (exceedsJsonChars(body, MAX_ENVELOPE_JSON_CHARS)) {
      throw new WalletFileTooLargeError();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error('Invalid wallet file: not valid JSON');
    }

    if (!WalletFileService.isImportableEnvelope(parsed)) {
      throw new Error('Invalid wallet file: missing encrypted wallet data');
    }
    if (WalletFileService.isUnsupportedEnvelope(parsed)) {
      throw new UnsupportedWalletEnvelopeError();
    }

    return parsed as RawFullyEncryptedWallet;
  }

  static async decryptWalletFromFile(envelope: RawFullyEncryptedWallet, password: string): Promise<Wallet | null> {
    const result = await WalletFileService.decryptWalletImport(envelope, password);
    return result?.wallet ?? null;
  }

  static async decryptWalletImport(envelope: RawFullyEncryptedWallet, password: string): Promise<WalletFileDecryptResult | null> {
    if (!password) {
      return null;
    }
    assertCiphertextLength((envelope as { data?: unknown }).data);
    const wallet = await WalletEnvelopeCodec.openEncryptedWallet(envelope, password);
    if (wallet === null) {
      return null;
    }
    return { wallet, raw: wallet.exportToRaw() };
  }

  /** Spend key, view key, and creationHeight must match the wallet that was saved. */
  private static reopenMatches(opened: Wallet | null, raw: RawWallet): boolean {
    if (opened === null) {
      return false;
    }
    const spend = raw.keys?.priv?.spend;
    const view = raw.keys?.priv?.view;
    if (typeof spend !== 'string' || typeof view !== 'string') {
      return false;
    }
    const height = raw.creationHeight ?? 0;
    return opened.keys?.priv?.spend === spend && opened.keys?.priv?.view === view && opened.creationHeight === height;
  }

  private static isUnsupportedEnvelope(value: RawFullyEncryptedWallet): boolean {
    const candidate = value as unknown as Record<string, unknown>;
    if ('envelope' in candidate && candidate.envelope !== 3) {
      return true;
    }
    return Array.isArray(candidate.encryptedKeys) && !Array.isArray(candidate.data);
  }

  private static isImportableEnvelope(value: unknown): value is RawFullyEncryptedWallet {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    if (Array.isArray(candidate.encryptedKeys)) {
      return true;
    }
    return Array.isArray(candidate.data) && typeof candidate.nonce === 'string';
  }
}
