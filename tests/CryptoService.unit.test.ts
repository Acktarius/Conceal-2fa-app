import { describe, expect, it } from 'vitest';
import { CryptoService } from '../services/CryptoService';

/** RFC 4231 test case 1 vectors for HMAC-SHA1. */
const hmacSha1Key = new TextEncoder().encode('Jefe');
const hmacSha1Data = new TextEncoder().encode('what do ya want for nothing?');

describe('CryptoService', () => {
  it('decodes base32 secrets deterministically', () => {
    const first = CryptoService.base32Decode('JBSWY3DPEHPK3PXP');
    const second = CryptoService.base32Decode('JBSWY3DPEHPK3PXP');
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(Array.from(first.slice(0, 6))).toEqual(Array.from(new TextEncoder().encode('Hello!')));
  });

  it('computes stable HMAC-SHA1 output', async () => {
    const first = await CryptoService.hmacSha1(hmacSha1Key, hmacSha1Data);
    const second = await CryptoService.hmacSha1(hmacSha1Key, hmacSha1Data);
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(first.length).toBe(20);
  });

  it('computes deterministic HMAC-SHA256 output', async () => {
    const key = new TextEncoder().encode('key');
    const data = new TextEncoder().encode('data');
    const first = await CryptoService.hmacSha256(key, data);
    const second = await CryptoService.hmacSha256(key, data);
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(first.length).toBe(32);
  });

  it('computes deterministic HMAC-SHA512 output', async () => {
    const key = new TextEncoder().encode('key');
    const data = new TextEncoder().encode('data');
    const first = await CryptoService.hmacSha512(key, data);
    const second = await CryptoService.hmacSha512(key, data);
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(first.length).toBe(64);
  });
});
