import { existsSync, readFileSync } from 'node:fs';
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
import { WalletEnvelopeCodec } from '../services/WalletEnvelopeCodec';

/** Test-only plaintext sealed into tests/fixtures/envelope3-golden.json. */
const PASSWORD = 'golden-fixture-password';
const SPEND = '11'.repeat(32);
const VIEW = '22'.repeat(32);
const CREATION_HEIGHT = 424242;
const FIXTURE_PATH = new URL('./fixtures/envelope3-golden.json', import.meta.url);

mockLoadFromRaw.mockImplementation((raw: RawWallet) => ({
  keys: raw.keys,
  creationHeight: raw.creationHeight,
}));

describe('golden Envelope 3 fixture', () => {
  it('opens the committed Argon2id envelope and recovers spend key, view key, and creationHeight', async () => {
    expect({ fixturePresent: existsSync(FIXTURE_PATH) }).toEqual({ fixturePresent: true });

    const envelope = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as {
      envelope: number;
      kdf: { alg: string; v: number; m: number; t: number; p: number; salt: string };
      nonce: string;
    };
    expect(envelope.envelope).toBe(3);
    expect(envelope.kdf).toMatchObject({ alg: 'argon2id', v: 19, m: 32768, t: 3, p: 1 });
    expect(envelope.kdf.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(envelope.nonce).toMatch(/^[0-9a-f]{48}$/);

    const wallet = await WalletEnvelopeCodec.openEncryptedWallet(envelope, PASSWORD);
    expect(wallet).not.toBeNull();
    expect(wallet!.keys.priv.spend).toBe(SPEND);
    expect(wallet!.keys.priv.view).toBe(VIEW);
    expect(wallet!.creationHeight).toBe(CREATION_HEIGHT);
  });
});
