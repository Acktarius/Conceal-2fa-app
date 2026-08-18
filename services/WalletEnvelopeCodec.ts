/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * Encrypted wallet file envelope — mirrors conceal-wallet-sdk `envelope.ts`
 * (saveEncryptedWallet / openEncryptedWallet). Used for file export/import only.
 *
 * @see conceal-next-wallet/node_modules/conceal-wallet-sdk/dist/index.js (envelope)
 */

import { config } from '../config';
import { type RawFullyEncryptedWallet, type RawWallet, Wallet } from '../model/Wallet';

const KEY_LENGTH = 32;
/** SDK: base64(16 random bytes) → 24-char string, UTF-8 encoded for secretbox nonce. */
const SDK_NONCE_STRING_LENGTH = 24;

type NaclGlobal = {
  util?: { encodeBase64: (bytes: Uint8Array) => string };
  secretbox: {
    (message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
    open(box: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
  };
};

function getNacl(): NaclGlobal {
  const naclRef = (globalThis as { nacl?: NaclGlobal }).nacl;
  if (!naclRef) {
    throw new Error('nacl is not available');
  }
  return naclRef;
}

function normalizeWalletPassword(password: string): Uint8Array {
  let normalized = password;
  if (normalized.length > KEY_LENGTH) {
    normalized = normalized.slice(0, KEY_LENGTH);
  } else if (normalized.length < KEY_LENGTH) {
    normalized = `${'0'.repeat(KEY_LENGTH)}${normalized}`.slice(-KEY_LENGTH);
  }

  let key = new TextEncoder().encode(normalized);
  if (key.length > KEY_LENGTH) {
    key = key.slice(-KEY_LENGTH);
  }
  return key;
}

function encodeBase64(bytes: Uint8Array): string {
  const naclRef = (globalThis as { nacl?: NaclGlobal }).nacl;
  if (naclRef?.util?.encodeBase64) {
    return naclRef.util.encodeBase64(bytes);
  }
  return btoa(String.fromCharCode(...bytes));
}

function generateRawNonce(): string {
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  return encodeBase64(random);
}

function sdkNonceBytes(nonceStr: string): Uint8Array {
  const bytes = new TextEncoder().encode(nonceStr);
  if (bytes.length !== SDK_NONCE_STRING_LENGTH) {
    throw new Error('Invalid wallet file: unsupported nonce format');
  }
  return bytes;
}

/** File backup codec — wire-compatible with conceal-wallet-sdk / next-wallet. */
export class WalletEnvelopeCodec {
  static saveEncryptedWallet(raw: RawWallet, password: string): RawFullyEncryptedWallet {
    const key = normalizeWalletPassword(password);
    const rawNonce = generateRawNonce();
    const nonce = new TextEncoder().encode(rawNonce);
    const message = new TextEncoder().encode(JSON.stringify(raw));
    const cipher = getNacl().secretbox(message, nonce, key);
    return {
      data: Array.from(cipher),
      nonce: rawNonce,
    };
  }

  static decryptEnvelopeToRaw(envelope: RawFullyEncryptedWallet, password: string): RawWallet | null {
    if (!password || !Array.isArray(envelope.data) || typeof envelope.nonce !== 'string') {
      return null;
    }

    const key = normalizeWalletPassword(password);
    let plain: Uint8Array | null;
    try {
      plain = getNacl().secretbox.open(Uint8Array.from(envelope.data), sdkNonceBytes(envelope.nonce), key);
    } catch {
      return null;
    }

    if (plain === null) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(plain));
    } catch {
      return null;
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const raw = parsed as RawWallet;
    if (raw.coinAddressPrefix !== undefined && raw.coinAddressPrefix !== config.addressPrefix) {
      return null;
    }

    return raw;
  }

  static openEncryptedWallet(envelope: RawFullyEncryptedWallet, password: string): Wallet | null {
    const raw = WalletEnvelopeCodec.decryptEnvelopeToRaw(envelope, password);
    if (raw === null) {
      return null;
    }
    return Wallet.loadFromRaw(raw);
  }
}
