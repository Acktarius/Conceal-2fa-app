import { describe, expect, it } from 'vitest';
import { JSChaCha8 } from '../model/ChaCha8';

describe('JSChaCha8', () => {
  const key = new Uint8Array(32).fill(1);
  const nonce = new Uint8Array(12).fill(2);

  it('encrypt/decrypt round-trip restores plaintext', () => {
    const plaintext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const encrypted = new JSChaCha8(key, nonce).encrypt(plaintext);
    const decrypted = new JSChaCha8(key, nonce).decrypt(encrypted);
    expect(Array.from(decrypted)).toEqual(Array.from(plaintext));
    expect(Array.from(encrypted)).not.toEqual(Array.from(plaintext));
  });

  it('rejects invalid key and nonce sizes', () => {
    expect(() => new JSChaCha8(new Uint8Array(16), nonce)).toThrow('Key should be 32 byte buffer');
    expect(() => new JSChaCha8(key, new Uint8Array(8))).toThrow('Nonce should be 12 byte buffer');
  });
});
