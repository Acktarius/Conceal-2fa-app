import { beforeEach, describe, expect, it, vi } from 'vitest';

// RN exposes nacl globally; load it for unit tests.
import '../lib/nacl-fast.js';

vi.mock('../config', () => ({
  config: { addressPrefix: 0x7ad4 },
}));

const mockLoadFromRaw = vi.fn();

vi.mock('../model/Wallet', () => ({
  Wallet: {
    loadFromRaw: (...args: unknown[]) => mockLoadFromRaw(...args),
  },
}));

import type { RawWallet } from '../model/Wallet';
import { WalletEnvelopeCodec } from '../services/WalletEnvelopeCodec';

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

describe('WalletEnvelopeCodec (conceal-wallet-sdk envelope)', () => {
  beforeEach(() => {
    mockLoadFromRaw.mockReset();
    mockLoadFromRaw.mockImplementation((raw: RawWallet) => ({
      keys: raw.keys,
      lastHeight: raw.lastHeight,
    }));
  });

  it('uses 24-char SDK nonce strings', () => {
    const envelope = WalletEnvelopeCodec.saveEncryptedWallet(minimalRaw(), 'export-pass');
    expect(envelope.nonce.length).toBe(24);
    expect(envelope.data.length).toBeGreaterThan(0);
  });

  it('round-trips encrypt and decrypt', () => {
    const password = 'my-file-password';
    const envelope = WalletEnvelopeCodec.saveEncryptedWallet(minimalRaw(), password);
    const wallet = WalletEnvelopeCodec.openEncryptedWallet(envelope, password);

    expect(wallet).not.toBeNull();
    expect(mockLoadFromRaw).toHaveBeenCalled();
    expect(wallet!.keys.priv.spend).toBe('aa'.repeat(32));
    expect(wallet!.lastHeight).toBe(42);
  });

  it('returns null for wrong password', () => {
    const envelope = WalletEnvelopeCodec.saveEncryptedWallet(minimalRaw(), 'correct');
    expect(WalletEnvelopeCodec.openEncryptedWallet(envelope, 'wrong')).toBeNull();
  });

  it('rejects non-SDK nonce length on decrypt', () => {
    const envelope = WalletEnvelopeCodec.saveEncryptedWallet(minimalRaw(), 'pass');
    const badNonce = { ...envelope, nonce: btoa(String.fromCharCode(...new Uint8Array(24))) };
    expect(badNonce.nonce.length).toBe(32);
    expect(WalletEnvelopeCodec.openEncryptedWallet(badNonce, 'pass')).toBeNull();
  });
});
