import { afterEach, describe, expect, it, vi } from 'vitest';
import { MathUtil } from '../model/MathUtil';

describe('MathUtil', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getRandomInt returns values within the inclusive range', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (buffer: Uint32Array) => {
        buffer[0] = 42;
        return buffer;
      },
    });
    expect(MathUtil.getRandomInt(5, 10)).toBe(5 + (42 % 6));
  });

  it('randomTriangularSimplified stays below max', () => {
    vi.spyOn(MathUtil, 'randomUint32').mockReturnValue(123456789);
    const value = MathUtil.randomTriangularSimplified(100);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(100);
  });
});
