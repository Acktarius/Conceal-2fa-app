import '../../lib/nacl-fast.js';
import { crypto as ccxCrypto } from '/home/katana/conceal-wallet-sdk/node_modules/conceal-lib-js/src/index.js';

type NaclSecretbox = {
  (message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  open(box: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
};

export type ConcealCryptoTestBridge = {
  argon2id: (password: ArrayBuffer, salt: ArrayBuffer, memoryKiB: number, iterations: number, parallelism: number) => Promise<ArrayBuffer>;
  secretbox: (message: ArrayBuffer, nonce: ArrayBuffer, key: ArrayBuffer) => ArrayBuffer;
  secretboxOpen: (cipher: ArrayBuffer, nonce: ArrayBuffer, key: ArrayBuffer) => ArrayBuffer | null;
  randomBytes: (byteLength: number) => ArrayBuffer;
};

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

function naclSecretbox(): NaclSecretbox {
  const nacl = (globalThis as { nacl?: { secretbox?: NaclSecretbox } }).nacl;
  if (!nacl?.secretbox) {
    throw new Error('nacl is not available');
  }
  return nacl.secretbox;
}

const bridge: ConcealCryptoTestBridge = {
  randomBytes(byteLength: number): ArrayBuffer {
    const buffer = new ArrayBuffer(byteLength);
    crypto.getRandomValues(new Uint8Array(buffer));
    return buffer;
  },
  async argon2id(password, salt, memoryKiB, iterations, parallelism) {
    const passwordBuffer = requireArrayBuffer(password, 'password');
    const saltBuffer = requireArrayBuffer(salt, 'salt');
    const keyHex = ccxCrypto.argon2id(
      hexEncode(new Uint8Array(passwordBuffer)),
      hexEncode(new Uint8Array(saltBuffer)),
      memoryKiB,
      iterations,
      parallelism
    );
    return hexToArrayBuffer(keyHex);
  },
  secretbox(message, nonce, key) {
    const cipher = naclSecretbox()(
      new Uint8Array(requireArrayBuffer(message, 'message')),
      new Uint8Array(requireArrayBuffer(nonce, 'nonce')),
      new Uint8Array(requireArrayBuffer(key, 'key'))
    );
    return copyToArrayBuffer(cipher);
  },
  secretboxOpen(cipher, nonce, key) {
    const plain = naclSecretbox().open(
      new Uint8Array(requireArrayBuffer(cipher, 'cipher')),
      new Uint8Array(requireArrayBuffer(nonce, 'nonce')),
      new Uint8Array(requireArrayBuffer(key, 'key'))
    );
    return plain === null ? null : copyToArrayBuffer(plain);
  },
};

(globalThis as { __concealEnvelope3Test?: ConcealCryptoTestBridge }).__concealEnvelope3Test = bridge;
