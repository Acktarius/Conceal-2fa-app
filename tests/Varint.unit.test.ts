import { describe, expect, it } from 'vitest';
import { decode, encode } from '../model/Varint';

describe('Varint', () => {
  it('round-trips small values', () => {
    for (const value of [0, 1, 127, 128, 300, 16384]) {
      const encoded = encode(value);
      const decoded = decode(encoded);
      expect(decoded).toBe(value);
      expect(encode.bytes).toBe(decode.bytes);
    }
  });

  it('encodes known byte sequences', () => {
    const encoded = encode(300);
    expect(Array.from(encoded as number[])).toEqual([0xac, 0x02]);
    expect(encode.bytes).toBe(2);
  });
});
