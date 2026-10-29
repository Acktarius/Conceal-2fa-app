import { describe, expect, it } from 'vitest';
import { messageIndexToIetfNonce } from '../model/MessageNonce';

const bytes = (index: number) => Array.from(new Uint8Array(messageIndexToIetfNonce(index)));

describe('messageIndexToIetfNonce', () => {
  it('index 0 is 12 zero bytes', () => {
    expect(bytes(0)).toEqual(new Array(12).fill(0));
  });

  it('index 1 is 0^4 followed by BE64(1), not BE64(1) followed by 0^4', () => {
    expect(bytes(1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('index 256 and 2^32 are big-endian at offset 4', () => {
    expect(bytes(256)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
    expect(bytes(2 ** 32)).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
  });

  it('matches the legacy 8-byte IV prefixed with 4 zero bytes', () => {
    const index = 0x0102030405;
    const iv = new ArrayBuffer(8);
    new DataView(iv).setBigUint64(0, BigInt(index), false);
    expect(bytes(index)).toEqual([0, 0, 0, 0, ...new Uint8Array(iv)]);
  });

  it('rejects negative, fractional and unsafe indexes', () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => messageIndexToIetfNonce(bad)).toThrow(RangeError);
    }
  });
});
