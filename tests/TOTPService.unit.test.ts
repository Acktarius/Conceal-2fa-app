import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CryptoService } from '../services/CryptoService';
import { TOTPService } from '../services/TOTPService';

vi.mock('react-native-conceal-crypto', () => ({
  default: {
    hmacSha1: () => {
      throw new Error('force JS fallback');
    },
    hmacSha256: () => {
      throw new Error('force JS fallback');
    },
    hmacSha512: () => {
      throw new Error('force JS fallback');
    },
  },
}));

/** RFC 6238 SHA1 test vector (secret = "Hello!" in base32). */
const RFC6238_SECRET = 'JBSWY3DPEHPK3PXP';

describe('TOTPService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('generates stable TOTP for known secret and time step', async () => {
    const code = await TOTPService.generateTOTPForTimeStep(RFC6238_SECRET, 1, 'SHA1', 6);
    expect(code).toBe('996554');
  });

  it('matches JS fallback when native crypto throws', async () => {
    const secretBytes = CryptoService.base32Decode(RFC6238_SECRET);
    const counter = new Uint8Array(8);
    new DataView(counter.buffer).setBigUint64(0, BigInt(1), false);
    const hmac = await CryptoService.hmacSha1(secretBytes, counter);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const raw =
      ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
    const expected = (raw % 10 ** 6).toString().padStart(6, '0');
    const code = await TOTPService.generateTOTPForTimeStep(RFC6238_SECRET, 1);
    expect(code).toBe(expected);
  });

  it('validates well-formed secrets', () => {
    expect(TOTPService.validateSecret(RFC6238_SECRET)).toBe(true);
    expect(TOTPService.validateSecret('not-valid!!!')).toBe(false);
  });

  it('computes time remaining within period bounds', () => {
    const remaining = TOTPService.getTimeRemaining(30);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(30);
  });
});
