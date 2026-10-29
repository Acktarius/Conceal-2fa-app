import { beforeEach, describe, expect, it, vi } from 'vitest';

// RN exposes nacl globally; load it for unit tests.
import '../lib/nacl-fast.js';
// Real Argon2id (Nitro cannot run here). Same primitive as conceal-wallet-sdk.
import { crypto as ccxCrypto } from '/home/katana/conceal-wallet-sdk/node_modules/conceal-lib-js/src/index.js';

const SALT_BYTES = 16;
const NONCE_BYTES = 24;
const MAX_PASSWORD_UTF8_BYTES = 1024;
const WRITE_PROFILE = { alg: 'argon2id', v: 19, m: 32768, t: 3, p: 1 } as const;
const CLOSED_KDF_KEYS = ['alg', 'v', 'm', 't', 'p', 'salt'] as const;

type Envelope3Kdf = {
  alg: string;
  v: number;
  m: number;
  t: number;
  p: number;
  salt: string;
};

type Envelope3Wire = {
  envelope: 3;
  kdf: Envelope3Kdf;
  nonce: string;
  data: number[];
};

type Argon2idFn = (
  password: ArrayBuffer,
  salt: ArrayBuffer,
  memoryKiB: number,
  iterations: number,
  parallelism: number
) => Promise<ArrayBuffer>;
type SecretboxFn = (message: ArrayBuffer, nonce: ArrayBuffer, key: ArrayBuffer) => ArrayBuffer;
type SecretboxOpenFn = (cipher: ArrayBuffer, nonce: ArrayBuffer, key: ArrayBuffer) => ArrayBuffer | null;

const bridge = vi.hoisted(() => ({
  argon2id: null as Argon2idFn | null,
  secretbox: null as SecretboxFn | null,
  secretboxOpen: null as SecretboxOpenFn | null,
  randomBytes: null as ((byteLength: number) => ArrayBuffer) | null,
  passwordBuffers: [] as ArrayBuffer[],
  passwordSnapshots: [] as Uint8Array[],
  keyBuffers: [] as ArrayBuffer[],
  saltByteLengths: [] as number[],
}));

vi.mock('react-native-conceal-crypto', () => ({
  default: {
    argon2id: (password: ArrayBuffer, salt: ArrayBuffer, memoryKiB: number, iterations: number, parallelism: number) => {
      if (bridge.argon2id === null) {
        throw new Error('argon2id bridge is not installed');
      }
      return bridge.argon2id(password, salt, memoryKiB, iterations, parallelism);
    },
    secretbox: (message: ArrayBuffer, nonce: ArrayBuffer, key: ArrayBuffer) => {
      if (bridge.secretbox === null) {
        throw new Error('secretbox bridge is not installed');
      }
      return bridge.secretbox(message, nonce, key);
    },
    secretboxOpen: (cipher: ArrayBuffer, nonce: ArrayBuffer, key: ArrayBuffer) => {
      if (bridge.secretboxOpen === null) {
        throw new Error('secretboxOpen bridge is not installed');
      }
      return bridge.secretboxOpen(cipher, nonce, key);
    },
    randomBytes: (byteLength: number) => {
      if (bridge.randomBytes === null) {
        throw new Error('randomBytes bridge is not installed');
      }
      return bridge.randomBytes(byteLength);
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

import concealCrypto from 'react-native-conceal-crypto';
import type { RawFullyEncryptedWallet, RawWallet } from '../model/Wallet';
import { UnsupportedWalletEnvelopeError, WalletEnvelopeCodec } from '../services/WalletEnvelopeCodec';

type NaclSecretbox = {
  (message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  open(box: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
};

function naclSecretbox(): NaclSecretbox {
  const nacl = (globalThis as { nacl?: { secretbox?: NaclSecretbox } }).nacl;
  if (!nacl?.secretbox) {
    throw new Error('nacl is not available');
  }
  return nacl.secretbox;
}

function requireArrayBuffer(value: unknown, label: string): ArrayBuffer {
  if (!(value instanceof ArrayBuffer)) {
    throw new TypeError(`${label} must be an ArrayBuffer`);
  }
  return value;
}

function hexEncode(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const buffer = new ArrayBuffer(hex.length / 2);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i++) {
    view[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return buffer;
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function utf8ToArrayBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  return copyToArrayBuffer(bytes);
}

function repeatToUtf8ByteLength(byteLength: number): string {
  const unit = 'é';
  const unitBytes = new TextEncoder().encode(unit).length;
  if (byteLength % unitBytes !== 0) {
    throw new Error('byte length must be a multiple of the unit character');
  }
  const password = unit.repeat(byteLength / unitBytes);
  if (new TextEncoder().encode(password).length !== byteLength) {
    throw new Error('password fixture byte length mismatch');
  }
  return password;
}

function isWiped(buffer: ArrayBuffer): boolean {
  return new Uint8Array(buffer).every((byte) => byte === 0);
}

bridge.randomBytes = (byteLength: number) => {
  const buffer = new ArrayBuffer(byteLength);
  crypto.getRandomValues(new Uint8Array(buffer));
  return buffer;
};

bridge.argon2id = async (password, salt, memoryKiB, iterations, parallelism) => {
  const passwordBuffer = requireArrayBuffer(password, 'password');
  const saltBuffer = requireArrayBuffer(salt, 'salt');
  bridge.passwordBuffers.push(passwordBuffer);
  bridge.passwordSnapshots.push(new Uint8Array(passwordBuffer).slice());
  bridge.saltByteLengths.push(saltBuffer.byteLength);
  const keyHex = ccxCrypto.argon2id(
    hexEncode(new Uint8Array(passwordBuffer)),
    hexEncode(new Uint8Array(saltBuffer)),
    memoryKiB,
    iterations,
    parallelism
  );
  const key = hexToArrayBuffer(keyHex);
  bridge.keyBuffers.push(key);
  return key;
};

bridge.secretbox = (message, nonce, key) => {
  const cipher = naclSecretbox()(
    new Uint8Array(requireArrayBuffer(message, 'message')),
    new Uint8Array(requireArrayBuffer(nonce, 'nonce')),
    new Uint8Array(requireArrayBuffer(key, 'key'))
  );
  return copyToArrayBuffer(cipher);
};

bridge.secretboxOpen = (cipher, nonce, key) => {
  const plain = naclSecretbox().open(
    new Uint8Array(requireArrayBuffer(cipher, 'cipher')),
    new Uint8Array(requireArrayBuffer(nonce, 'nonce')),
    new Uint8Array(requireArrayBuffer(key, 'key'))
  );
  return plain === null ? null : copyToArrayBuffer(plain);
};

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

async function sealEnvelope3(
  raw: RawWallet,
  password: string,
  mutateInner?: (inner: Record<string, unknown>) => void,
  plaintext?: unknown
): Promise<Envelope3Wire> {
  const salt = bridge.randomBytes?.(SALT_BYTES);
  const nonce = bridge.randomBytes?.(NONCE_BYTES);
  if (salt === undefined || nonce === undefined) {
    throw new Error('crypto bridge is not installed');
  }
  const kdf: Envelope3Kdf = {
    ...WRITE_PROFILE,
    salt: hexEncode(new Uint8Array(salt)),
  };
  const nonceHex = hexEncode(new Uint8Array(nonce));
  const inner: Record<string, unknown> = {
    envelope: 3,
    kdf,
    nonce: nonceHex,
    wallet: raw,
  };
  mutateInner?.(inner);
  const key = await concealCrypto.argon2id(utf8ToArrayBuffer(password), salt, kdf.m, kdf.t, kdf.p);
  const message = utf8ToArrayBuffer(JSON.stringify(plaintext ?? inner));
  const cipher = concealCrypto.secretbox(message, nonce, key);
  return {
    envelope: 3,
    kdf,
    nonce: nonceHex,
    data: Array.from(new Uint8Array(cipher)),
  };
}

describe('WalletEnvelopeCodec Envelope 3', () => {
  beforeEach(() => {
    bridge.passwordBuffers.length = 0;
    bridge.passwordSnapshots.length = 0;
    bridge.keyBuffers.length = 0;
    bridge.saltByteLengths.length = 0;
    mockLoadFromRaw.mockReset();
    mockLoadFromRaw.mockImplementation((raw: RawWallet) => ({
      keys: raw.keys,
      lastHeight: raw.lastHeight,
      creationHeight: raw.creationHeight,
    }));
  });

  it('writes Envelope 3 with the Argon2id write profile and wipes password and key buffers', async () => {
    const password = 'export-pass';
    const envelope = (await WalletEnvelopeCodec.saveEncryptedWallet(minimalRaw(), password)) as Envelope3Wire;
    const again = (await WalletEnvelopeCodec.saveEncryptedWallet(minimalRaw(), password)) as Envelope3Wire;

    expect(envelope.envelope).toBe(3);
    expect(envelope.kdf).toMatchObject(WRITE_PROFILE);
    expect(envelope.kdf.salt).toMatch(new RegExp(`^[0-9a-f]{${SALT_BYTES * 2}}$`));
    expect(Object.keys(envelope.kdf).sort()).toEqual([...CLOSED_KDF_KEYS].sort());
    expect(envelope.nonce).toMatch(new RegExp(`^[0-9a-f]{${NONCE_BYTES * 2}}$`));
    expect(envelope.data.length).toBeGreaterThan(0);
    expect(envelope.data.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)).toBe(true);
    expect(again.kdf.salt).not.toBe(envelope.kdf.salt);
    expect(again.nonce).not.toBe(envelope.nonce);

    const wallet = await WalletEnvelopeCodec.openEncryptedWallet(envelope, password);
    expect(wallet).not.toBeNull();
    expect(wallet!.keys.priv.spend).toBe(minimalRaw().keys!.priv.spend);
    expect(wallet!.keys.priv.view).toBe(minimalRaw().keys!.priv.view);
    expect(wallet!.creationHeight).toBe(10);

    const passwordBytes = new TextEncoder().encode(password);
    expect(bridge.passwordSnapshots).toHaveLength(3);
    expect(bridge.passwordSnapshots[0]).toEqual(passwordBytes);
    expect(bridge.passwordSnapshots[1]).toEqual(passwordBytes);
    expect(bridge.passwordSnapshots[2]).toEqual(passwordBytes);
    expect(bridge.saltByteLengths).toEqual([SALT_BYTES, SALT_BYTES, SALT_BYTES]);
    expect(bridge.passwordBuffers).toHaveLength(3);
    expect(bridge.keyBuffers).toHaveLength(3);
    for (const buffer of bridge.passwordBuffers) {
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBe(passwordBytes.byteLength);
      expect(isWiped(buffer)).toBe(true);
    }
    for (const buffer of bridge.keyBuffers) {
      expect(buffer.byteLength).toBe(32);
      expect(isWiped(buffer)).toBe(true);
    }
  });

  it('opens a raw UTF-8 password and returns null for a wrong or legacy-padded password', async () => {
    const password = '1';
    const envelope = await sealEnvelope3(minimalRaw(), password);
    const wallet = await WalletEnvelopeCodec.openEncryptedWallet(envelope, password);

    expect(wallet).not.toBeNull();
    expect(wallet!.keys.priv.spend).toBe(minimalRaw().keys!.priv.spend);
    expect(wallet!.creationHeight).toBe(10);

    const padded = `${'0'.repeat(31)}${password}`;
    expect(padded.length).toBe(32);
    expect(await WalletEnvelopeCodec.openEncryptedWallet(envelope, padded)).toBeNull();
    expect(await WalletEnvelopeCodec.openEncryptedWallet(envelope, 'wrong-password')).toBeNull();
  });

  it('throws RangeError when the password UTF-8 length exceeds 1024 bytes', async () => {
    const password = repeatToUtf8ByteLength(MAX_PASSWORD_UTF8_BYTES + 2);
    expect(new TextEncoder().encode(password).length).toBe(MAX_PASSWORD_UTF8_BYTES + 2);

    let thrown: unknown = null;
    try {
      await WalletEnvelopeCodec.saveEncryptedWallet(minimalRaw(), password);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RangeError);
  });

  it('saves a password of exactly 1024 UTF-8 bytes', async () => {
    const password = repeatToUtf8ByteLength(MAX_PASSWORD_UTF8_BYTES);
    const envelope = (await WalletEnvelopeCodec.saveEncryptedWallet(minimalRaw(), password)) as Envelope3Wire;
    expect(envelope.envelope).toBe(3);
    expect(envelope.kdf).toMatchObject(WRITE_PROFILE);
  });

  it('returns null when opening with a password over 1024 UTF-8 bytes', async () => {
    const password = 'short-password';
    const envelope = await sealEnvelope3(minimalRaw(), password);
    expect(await WalletEnvelopeCodec.openEncryptedWallet(envelope, password)).not.toBeNull();
    const over = repeatToUtf8ByteLength(MAX_PASSWORD_UTF8_BYTES + 2);
    expect(await WalletEnvelopeCodec.openEncryptedWallet(envelope, over)).toBeNull();
  });

  it('rejects a KDF object that is not the closed set', async () => {
    const password = 'closed-kdf';
    const envelope = await sealEnvelope3(minimalRaw(), password);
    const opened = await WalletEnvelopeCodec.openEncryptedWallet(envelope, password);
    expect(opened).not.toBeNull();
    const callsAfterValid = mockLoadFromRaw.mock.calls.length;

    const extraKey = {
      ...envelope,
      kdf: { ...envelope.kdf, note: 'extra' },
    };
    const missingSalt = {
      ...envelope,
      kdf: { alg: envelope.kdf.alg, v: envelope.kdf.v, m: envelope.kdf.m, t: envelope.kdf.t, p: envelope.kdf.p },
    };
    const wrongAlg = {
      ...envelope,
      kdf: { ...envelope.kdf, alg: 'scrypt' },
    };

    expect(await WalletEnvelopeCodec.openEncryptedWallet(extraKey, password)).toBeNull();
    expect(await WalletEnvelopeCodec.openEncryptedWallet(missingSalt, password)).toBeNull();
    expect(await WalletEnvelopeCodec.openEncryptedWallet(wrongAlg, password)).toBeNull();
    expect(mockLoadFromRaw.mock.calls.length).toBe(callsAfterValid);
  });

  it('rejects an inner plaintext that does not bind the outer kdf and nonce', async () => {
    const password = 'inner-bind';
    const raw = minimalRaw();
    const valid = await sealEnvelope3(raw, password);
    const wallet = await WalletEnvelopeCodec.openEncryptedWallet(valid, password);
    expect(wallet).not.toBeNull();
    expect(wallet!.keys.priv.view).toBe(raw.keys!.priv.view);
    expect(wallet!.creationHeight).toBe(raw.creationHeight);

    const badNonce = await sealEnvelope3(raw, password, (inner) => {
      inner.nonce = 'ab'.repeat(NONCE_BYTES);
    });
    const badKdf = await sealEnvelope3(raw, password, (inner) => {
      inner.kdf = { ...(inner.kdf as Envelope3Kdf), salt: 'cd'.repeat(SALT_BYTES) };
    });
    const rawPlaintext = await sealEnvelope3(raw, password, undefined, raw);

    expect(await WalletEnvelopeCodec.openEncryptedWallet(badNonce, password)).toBeNull();
    expect(await WalletEnvelopeCodec.openEncryptedWallet(badKdf, password)).toBeNull();
    expect(await WalletEnvelopeCodec.openEncryptedWallet(rawPlaintext, password)).toBeNull();
  });
});

const LEGACY_KEY_LENGTH = 32;

function legacyPasswordKey(password: string): Uint8Array {
  let normalized = password;
  if (normalized.length > LEGACY_KEY_LENGTH) {
    normalized = normalized.slice(0, LEGACY_KEY_LENGTH);
  } else if (normalized.length < LEGACY_KEY_LENGTH) {
    normalized = `${'0'.repeat(LEGACY_KEY_LENGTH)}${normalized}`.slice(-LEGACY_KEY_LENGTH);
  }
  let key = new TextEncoder().encode(normalized);
  if (key.length > LEGACY_KEY_LENGTH) {
    key = key.slice(-LEGACY_KEY_LENGTH);
  }
  return key;
}

function sealEnvelope2(raw: RawWallet, password: string): RawFullyEncryptedWallet {
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  const nonce = btoa(String.fromCharCode(...random));
  const message = new TextEncoder().encode(JSON.stringify(raw));
  const cipher = naclSecretbox()(message, new TextEncoder().encode(nonce), legacyPasswordKey(password));
  return { data: Array.from(cipher), nonce };
}

describe('WalletEnvelopeCodec envelope dispatch', () => {
  beforeEach(() => {
    mockLoadFromRaw.mockReset();
    mockLoadFromRaw.mockImplementation((raw: RawWallet) => ({
      keys: raw.keys,
      lastHeight: raw.lastHeight,
      creationHeight: raw.creationHeight,
    }));
  });

  it('opens Envelope 2 when the file has data and no envelope field', async () => {
    const password = 'legacy-pass';
    const envelope = sealEnvelope2(minimalRaw(), password);
    expect(envelope.nonce).toHaveLength(24);
    expect('envelope' in envelope).toBe(false);

    const wallet = await WalletEnvelopeCodec.openEncryptedWallet(envelope, password);
    expect(wallet).not.toBeNull();
    expect(wallet!.keys.priv.spend).toBe(minimalRaw().keys!.priv.spend);
    expect(wallet!.creationHeight).toBe(10);
  });

  it('rejects envelope numbers other than 3 before reading data', async () => {
    const password = 'legacy-pass';
    const legacy = sealEnvelope2(minimalRaw(), password);
    const spend = minimalRaw().keys!.priv.spend;

    for (const envelopeNumber of [1, 4, '3']) {
      mockLoadFromRaw.mockClear();
      const mixed = { ...legacy, envelope: envelopeNumber };
      await expect(WalletEnvelopeCodec.openEncryptedWallet(mixed as never, password)).rejects.toBeInstanceOf(
        UnsupportedWalletEnvelopeError
      );
      expect(mockLoadFromRaw).not.toHaveBeenCalled();
      await expect(WalletEnvelopeCodec.openEncryptedWallet(mixed as never, password)).rejects.toMatchObject({
        code: 'unsupported-wallet-envelope',
      });
    }

    const opened = await WalletEnvelopeCodec.openEncryptedWallet(legacy, password);
    expect(opened).not.toBeNull();
    expect(opened!.keys.priv.spend).toBe(spend);
  });

  it('rejects Envelope 1 without decrypting encryptedKeys', async () => {
    const envelope = { encryptedKeys: [1, 2, 3, 4], nonce: 'a'.repeat(24) };
    const openSpy = vi.spyOn(naclSecretbox(), 'open');
    try {
      await expect(WalletEnvelopeCodec.openEncryptedWallet(envelope as never, 'any-password')).rejects.toBeInstanceOf(
        UnsupportedWalletEnvelopeError
      );
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      openSpy.mockRestore();
    }
  });
});
