import { beforeEach, describe, expect, it, vi } from 'vitest';

// RN exposes nacl globally; load it for unit tests.
import '../lib/nacl-fast.js';
import './helpers/concealCryptoTestBridge';

vi.mock('react-native-conceal-crypto', () => ({
  default: {
    argon2id: (password: ArrayBuffer, salt: ArrayBuffer, memoryKiB: number, iterations: number, parallelism: number) => {
      const bridge = (globalThis as { __concealEnvelope3Test?: { argon2id: typeof password } }).__concealEnvelope3Test;
      if (!bridge) {
        throw new Error('conceal crypto test bridge is not installed');
      }
      return (
        bridge as {
          argon2id: (
            password: ArrayBuffer,
            salt: ArrayBuffer,
            memoryKiB: number,
            iterations: number,
            parallelism: number
          ) => Promise<ArrayBuffer>;
        }
      ).argon2id(password, salt, memoryKiB, iterations, parallelism);
    },
    secretbox: (message: ArrayBuffer, nonce: ArrayBuffer, key: ArrayBuffer) => {
      const bridge = (globalThis as { __concealEnvelope3Test?: { secretbox: unknown } }).__concealEnvelope3Test;
      if (!bridge) {
        throw new Error('conceal crypto test bridge is not installed');
      }
      return (
        bridge as {
          secretbox: (message: ArrayBuffer, nonce: ArrayBuffer, key: ArrayBuffer) => ArrayBuffer;
        }
      ).secretbox(message, nonce, key);
    },
    secretboxOpen: (cipher: ArrayBuffer, nonce: ArrayBuffer, key: ArrayBuffer) => {
      const bridge = (globalThis as { __concealEnvelope3Test?: { secretboxOpen: unknown } }).__concealEnvelope3Test;
      if (!bridge) {
        throw new Error('conceal crypto test bridge is not installed');
      }
      return (
        bridge as {
          secretboxOpen: (cipher: ArrayBuffer, nonce: ArrayBuffer, key: ArrayBuffer) => ArrayBuffer | null;
        }
      ).secretboxOpen(cipher, nonce, key);
    },
    randomBytes: (byteLength: number) => {
      const bridge = (globalThis as { __concealEnvelope3Test?: { randomBytes: unknown } }).__concealEnvelope3Test;
      if (!bridge) {
        throw new Error('conceal crypto test bridge is not installed');
      }
      return (bridge as { randomBytes: (byteLength: number) => ArrayBuffer }).randomBytes(byteLength);
    },
  },
}));

vi.mock('../config', () => ({
  config: { addressPrefix: 0x7ad4 },
}));

const mockLoadFromRaw = vi.fn();

vi.mock('../model/Wallet', () => ({
  Wallet: {
    loadFromRaw: (...args: unknown[]) => mockLoadFromRaw(...args),
  },
}));

import type { RawFullyEncryptedWallet, RawWallet } from '../model/Wallet';
import { WalletEnvelopeCodec } from '../services/WalletEnvelopeCodec';

const KEY_LENGTH = 32;

const minimalRaw = (): RawWallet => ({
  deposits: [],
  withdrawals: [],
  transactions: [],
  lastHeight: 42,
  nonce: '',
  keys: {
    priv: { spend: 'aa'.repeat(32), view: 'bb'.repeat(32) },
    pub: { spend: 'cc'.repeat(32), view: 'dd'.repeat(32) },
  },
  creationHeight: 10,
});

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
  const naclRef = (globalThis as { nacl?: { util?: { encodeBase64: (value: Uint8Array) => string } } }).nacl;
  if (naclRef?.util?.encodeBase64) {
    return naclRef.util.encodeBase64(bytes);
  }
  return btoa(String.fromCharCode(...bytes));
}

/** Envelope 2 fixture: 24-char base64 nonce and legacy pad/clamp key. */
function sealEnvelope2(raw: RawWallet, password: string): RawFullyEncryptedWallet {
  const nacl = (globalThis as { nacl: { secretbox: (message: Uint8Array, nonce: Uint8Array, key: Uint8Array) => Uint8Array } }).nacl;
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  const rawNonce = encodeBase64(random);
  const nonce = new TextEncoder().encode(rawNonce);
  const message = new TextEncoder().encode(JSON.stringify(raw));
  const cipher = nacl.secretbox(message, nonce, normalizeWalletPassword(password));
  return { data: Array.from(cipher), nonce: rawNonce };
}

describe('WalletEnvelopeCodec (conceal-wallet-sdk envelope)', () => {
  beforeEach(() => {
    mockLoadFromRaw.mockReset();
    mockLoadFromRaw.mockImplementation((raw: RawWallet) => ({
      keys: raw.keys,
      lastHeight: raw.lastHeight,
    }));
  });

  it('opens an Envelope 2 fixture that uses a 24-character nonce', async () => {
    const envelope = sealEnvelope2(minimalRaw(), 'export-pass');
    expect(envelope.nonce.length).toBe(24);
    expect(envelope.data.length).toBeGreaterThan(0);
    expect('envelope' in envelope).toBe(false);

    const wallet = await WalletEnvelopeCodec.openEncryptedWallet(envelope, 'export-pass');
    expect(wallet).not.toBeNull();
    expect(wallet!.keys.priv.spend).toBe('aa'.repeat(32));
  });

  it('round-trips encrypt and decrypt', async () => {
    const password = 'my-file-password';
    const envelope = await WalletEnvelopeCodec.saveEncryptedWallet(minimalRaw(), password);
    const wallet = await WalletEnvelopeCodec.openEncryptedWallet(envelope, password);

    expect(wallet).not.toBeNull();
    expect(mockLoadFromRaw).toHaveBeenCalled();
    expect(wallet!.keys.priv.spend).toBe('aa'.repeat(32));
    expect(wallet!.lastHeight).toBe(42);
  });

  it('returns null for wrong password', async () => {
    const envelope = await WalletEnvelopeCodec.saveEncryptedWallet(minimalRaw(), 'correct');
    expect(await WalletEnvelopeCodec.openEncryptedWallet(envelope, 'wrong')).toBeNull();
  });

  it('rejects non-SDK nonce length on decrypt', async () => {
    const envelope = sealEnvelope2(minimalRaw(), 'pass');
    const badNonce = { ...envelope, nonce: btoa(String.fromCharCode(...new Uint8Array(24))) };
    expect(badNonce.nonce.length).toBe(32);
    expect(await WalletEnvelopeCodec.openEncryptedWallet(badNonce, 'pass')).toBeNull();
  });
});
