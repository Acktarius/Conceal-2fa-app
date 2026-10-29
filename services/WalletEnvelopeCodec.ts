/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * Encrypted wallet file envelope — mirrors conceal-wallet-sdk `envelope.ts`
 * (saveEncryptedWallet / openEncryptedWallet). Used for file export/import only.
 *
 * @see conceal-next-wallet/node_modules/conceal-wallet-sdk/dist/index.js (envelope)
 */

import concealCrypto from 'react-native-conceal-crypto';
import { config } from '../config';
import { type RawFullyEncryptedWallet, type RawWallet, Wallet } from '../model/Wallet';

const KEY_LENGTH = 32;
/** SDK: base64(16 random bytes) → 24-char string, UTF-8 encoded for secretbox nonce. */
const SDK_NONCE_STRING_LENGTH = 24;
const MAX_ENVELOPE3_PASSWORD_BYTES = 1024;
const ENVELOPE3_SALT_BYTES = 16;
const ENVELOPE3_NONCE_BYTES = 24;
const MAX_ENVELOPE_CIPHERTEXT_BYTES = 8_388_608;
const CLOSED_KDF_KEYS = ['alg', 'v', 'm', 't', 'p', 'salt'] as const;
const ENVELOPE3_ALLOWED_PROFILES = new Set(['19456:2:1', '32768:3:1', '65536:3:1']);
const ENVELOPE3_WRITE_M = 32768;
const ENVELOPE3_WRITE_T = 3;
const ENVELOPE3_WRITE_P = 1;
const ENVELOPE3_WRITE_V = 19;

/** Closed Argon2id parameters on an Envelope 3 backup. */
export type Envelope3Kdf = {
  alg: 'argon2id';
  v: number;
  m: number;
  t: number;
  p: number;
  salt: string;
};

/** Envelope 3 wire format: Argon2id header plus secretbox ciphertext. */
export type Envelope3 = {
  envelope: 3;
  kdf: Envelope3Kdf;
  nonce: string;
  data: number[];
};

type NaclGlobal = {
  secretbox: {
    (message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
    open(box: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
  };
};

type ParsedClosedArgon2idKdf = Envelope3Kdf & {
  saltBytes: Uint8Array;
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

function sdkNonceBytes(nonceStr: string): Uint8Array {
  const bytes = new TextEncoder().encode(nonceStr);
  if (bytes.length !== SDK_NONCE_STRING_LENGTH) {
    throw new Error('Invalid wallet file: unsupported nonce format');
  }
  return bytes;
}

function wipe(buffer: ArrayBuffer | null): void {
  if (buffer) {
    new Uint8Array(buffer).fill(0);
  }
}

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer) {
    return bytes.buffer;
  }
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

/** UTF-8 bytes in an ArrayBuffer of exactly that length (Nitro reads the whole buffer). */
function utf8Buffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  const copy = exactBuffer(bytes);
  bytes.fill(0);
  return copy;
}

function hexEncode(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function hexDecode(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('invalid hex');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function parseClosedArgon2idKdf(value: unknown): ParsedClosedArgon2idKdf | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== CLOSED_KDF_KEYS.length) {
    return null;
  }
  for (const key of CLOSED_KDF_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
      return null;
    }
  }
  if (obj.alg !== 'argon2id') {
    return null;
  }
  if (typeof obj.v !== 'number' || typeof obj.m !== 'number' || typeof obj.t !== 'number' || typeof obj.p !== 'number') {
    return null;
  }
  if (typeof obj.salt !== 'string') {
    return null;
  }
  try {
    const saltBytes = hexDecode(obj.salt);
    if (saltBytes.length !== ENVELOPE3_SALT_BYTES) {
      return null;
    }
    return { alg: 'argon2id', v: obj.v, m: obj.m, t: obj.t, p: obj.p, salt: obj.salt, saltBytes };
  } catch {
    return null;
  }
}

function parseEnvelope3Nonce(nonce: unknown): Uint8Array | null {
  if (typeof nonce !== 'string') {
    return null;
  }
  try {
    const bytes = hexDecode(nonce);
    if (bytes.length !== ENVELOPE3_NONCE_BYTES) {
      return null;
    }
    return bytes;
  } catch {
    return null;
  }
}

function isCiphertextByteArray(data: unknown): data is number[] {
  if (!Array.isArray(data) || data.length > MAX_ENVELOPE_CIPHERTEXT_BYTES) {
    return false;
  }
  for (const byte of data) {
    if (typeof byte !== 'number' || !Number.isInteger(byte) || byte < 0 || byte > 255) {
      return false;
    }
  }
  return true;
}

function acceptEnvelope3KdfParams(kdf: ParsedClosedArgon2idKdf): boolean {
  if (kdf.v !== ENVELOPE3_WRITE_V) {
    return false;
  }
  const { m, t, p } = kdf;
  if (!(8 * p <= m && m <= 65536)) {
    return false;
  }
  if (!(1 <= t && t <= 64)) {
    return false;
  }
  if (!(1 <= p && p <= 4)) {
    return false;
  }
  return ENVELOPE3_ALLOWED_PROFILES.has(`${m}:${t}:${p}`);
}

function kdfParamsEqual(left: ParsedClosedArgon2idKdf, right: ParsedClosedArgon2idKdf): boolean {
  return (
    left.alg === right.alg &&
    left.v === right.v &&
    left.m === right.m &&
    left.t === right.t &&
    left.p === right.p &&
    bytesEqual(left.saltBytes, right.saltBytes)
  );
}

/** Envelope 1, or an `envelope` value other than 3. Distinct from null (wrong password). */
export class UnsupportedWalletEnvelopeError extends Error {
  readonly code = 'unsupported-wallet-envelope' as const;
  constructor() {
    super('Unsupported wallet envelope');
    this.name = 'UnsupportedWalletEnvelopeError';
  }
}

/** File backup codec — Envelope 3 writes, Envelope 2 opens with the legacy pad/clamp path. */
export class WalletEnvelopeCodec {
  /** Save a wallet backup as Envelope 3. RangeError when the password exceeds 1024 UTF-8 bytes. */
  static async saveEncryptedWallet(raw: RawWallet, password: string): Promise<Envelope3> {
    const passwordBuffer = utf8Buffer(password);
    let key: ArrayBuffer | null = null;
    let inner: ArrayBuffer | null = null;
    try {
      if (passwordBuffer.byteLength > MAX_ENVELOPE3_PASSWORD_BYTES) {
        throw new RangeError(`password UTF-8 length exceeds ${MAX_ENVELOPE3_PASSWORD_BYTES} bytes`);
      }
      const salt = concealCrypto.randomBytes(ENVELOPE3_SALT_BYTES);
      const nonce = concealCrypto.randomBytes(ENVELOPE3_NONCE_BYTES);
      const saltHex = hexEncode(new Uint8Array(salt));
      const nonceHex = hexEncode(new Uint8Array(nonce));
      const kdf: Envelope3Kdf = {
        alg: 'argon2id',
        v: ENVELOPE3_WRITE_V,
        m: ENVELOPE3_WRITE_M,
        t: ENVELOPE3_WRITE_T,
        p: ENVELOPE3_WRITE_P,
        salt: saltHex,
      };
      key = await concealCrypto.argon2id(passwordBuffer, salt, kdf.m, kdf.t, kdf.p);
      if (key.byteLength !== 32) {
        throw new Error('argon2id returned unexpected key length');
      }
      inner = utf8Buffer(JSON.stringify({ envelope: 3, kdf, nonce: nonceHex, wallet: raw }));
      const cipher = concealCrypto.secretbox(inner, nonce, key);
      return { envelope: 3, kdf, nonce: nonceHex, data: Array.from(new Uint8Array(cipher)) };
    } finally {
      wipe(passwordBuffer);
      wipe(key);
      wipe(inner);
    }
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

  /** Open Envelope 3 or Envelope 2. UnsupportedWalletEnvelopeError is not a wrong password (null). */
  static async openEncryptedWallet(envelope: unknown, password: string): Promise<Wallet | null> {
    if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope)) {
      return null;
    }
    const obj = envelope as Record<string, unknown>;
    if ('envelope' in obj) {
      if (obj.envelope !== 3) {
        throw new UnsupportedWalletEnvelopeError();
      }
      const raw = await WalletEnvelopeCodec.openEnvelope3(obj, password);
      if (raw === null) {
        return null;
      }
      return Wallet.loadFromRaw(raw);
    }
    if (Array.isArray(obj.data)) {
      const raw = WalletEnvelopeCodec.decryptEnvelopeToRaw(obj as RawFullyEncryptedWallet, password);
      if (raw === null) {
        return null;
      }
      return Wallet.loadFromRaw(raw);
    }
    if (Array.isArray(obj.encryptedKeys)) {
      throw new UnsupportedWalletEnvelopeError();
    }
    return null;
  }

  private static async openEnvelope3(obj: Record<string, unknown>, password: string): Promise<RawWallet | null> {
    const outerKdf = parseClosedArgon2idKdf(obj.kdf);
    if (outerKdf === null || !acceptEnvelope3KdfParams(outerKdf)) {
      return null;
    }
    const nonceBytes = parseEnvelope3Nonce(obj.nonce);
    if (nonceBytes === null || !isCiphertextByteArray(obj.data)) {
      return null;
    }

    const passwordBuffer = utf8Buffer(password);
    let key: ArrayBuffer | null = null;
    let plain: ArrayBuffer | null = null;
    try {
      if (passwordBuffer.byteLength > MAX_ENVELOPE3_PASSWORD_BYTES) {
        return null;
      }
      key = await concealCrypto.argon2id(passwordBuffer, exactBuffer(outerKdf.saltBytes), outerKdf.m, outerKdf.t, outerKdf.p);
      if (key.byteLength !== 32) {
        return null;
      }
      plain = concealCrypto.secretboxOpen(exactBuffer(Uint8Array.from(obj.data)), exactBuffer(nonceBytes), key);
      if (plain === null) {
        return null;
      }

      const parsed: unknown = JSON.parse(new TextDecoder().decode(new Uint8Array(plain)));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
      }
      const inner = parsed as Record<string, unknown>;
      if (inner.envelope !== 3) {
        return null;
      }
      const innerKdf = parseClosedArgon2idKdf(inner.kdf);
      if (innerKdf === null || !kdfParamsEqual(outerKdf, innerKdf)) {
        return null;
      }
      const innerNonce = parseEnvelope3Nonce(inner.nonce);
      if (innerNonce === null || !bytesEqual(nonceBytes, innerNonce)) {
        return null;
      }
      if (typeof inner.wallet !== 'object' || inner.wallet === null || Array.isArray(inner.wallet)) {
        return null;
      }
      const raw = inner.wallet as RawWallet;
      if (raw.coinAddressPrefix !== undefined && raw.coinAddressPrefix !== config.addressPrefix) {
        return null;
      }
      return raw;
    } catch {
      return null;
    } finally {
      wipe(passwordBuffer);
      wipe(key);
      wipe(plain);
    }
  }
}
