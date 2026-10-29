import { describe, expect, it, vi } from 'vitest';

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

import type { RawWallet } from '../model/Wallet';
import { WalletFileService } from '../services/WalletFileService';

/** Test-only keys. Argon2id runs through conceal-lib-js, not a constant stub. */
const PASSWORD = 'e2e-export-password';
const SPEND = 'ab'.repeat(32);
const VIEW = 'cd'.repeat(32);
const CREATION_HEIGHT = 515151;

const rawWallet = (): RawWallet => ({
  deposits: [],
  withdrawals: [],
  transactions: [],
  lastHeight: 80,
  nonce: '',
  keys: {
    priv: { spend: SPEND, view: VIEW },
    pub: { spend: 'ee'.repeat(32), view: 'ff'.repeat(32) },
  },
  creationHeight: CREATION_HEIGHT,
  coinAddressPrefix: 0x7ad4,
});

mockLoadFromRaw.mockImplementation((raw: RawWallet) => ({
  keys: raw.keys,
  creationHeight: raw.creationHeight,
  exportToRaw: () => raw,
}));

describe('WalletFileService Envelope 3 export then open', () => {
  it('recovers spend key, view key, and creationHeight after export then open', async () => {
    const wallet = {
      isLocal: () => false,
      exportToRaw: () => rawWallet(),
    };
    const text = await WalletFileService.createExportFileContent(wallet as never, PASSWORD);
    const parsed = WalletFileService.parseEncryptedWalletFile(text);
    const opened = await WalletFileService.decryptWalletImport(parsed, PASSWORD);

    expect(opened).not.toBeNull();
    expect(opened!.wallet.keys.priv.spend).toBe(SPEND);
    expect(opened!.wallet.keys.priv.view).toBe(VIEW);
    expect(opened!.wallet.creationHeight).toBe(CREATION_HEIGHT);
    expect(opened!.raw.creationHeight).toBe(CREATION_HEIGHT);
    process.stderr.write('creationHeight\n');
  });
});
