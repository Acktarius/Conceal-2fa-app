import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Caps match conceal-wallet-sdk `src/envelope.ts`: JSON chars are 4× ciphertext
 * bytes (`255,`), and raw text is 4× that so pretty backups still fit.
 */
const MAX_ENVELOPE_CIPHERTEXT_BYTES = 8_388_608;
const MAX_ENVELOPE_JSON_CHARS = 4 * MAX_ENVELOPE_CIPHERTEXT_BYTES;
const MAX_ENVELOPE_TEXT_CHARS = 4 * MAX_ENVELOPE_JSON_CHARS;

const mockSaveEncryptedWallet = vi.fn();
const mockOpenEncryptedWallet = vi.fn();
const mockDecryptEnvelopeToRaw = vi.fn();

vi.mock('../services/WalletEnvelopeCodec', () => ({
  WalletEnvelopeCodec: {
    saveEncryptedWallet: (...args: unknown[]) => mockSaveEncryptedWallet(...args),
    openEncryptedWallet: (...args: unknown[]) => mockOpenEncryptedWallet(...args),
    decryptEnvelopeToRaw: (...args: unknown[]) => mockDecryptEnvelopeToRaw(...args),
  },
  UnsupportedWalletEnvelopeError: class UnsupportedWalletEnvelopeError extends Error {
    readonly code = 'unsupported-wallet-envelope' as const;
    constructor() {
      super('Unsupported wallet envelope');
      this.name = 'UnsupportedWalletEnvelopeError';
    }
  },
}));

vi.mock('../model/Wallet', () => ({
  Wallet: {
    loadFromRaw: (raw: unknown) => raw,
  },
}));

import { UnsupportedWalletEnvelopeError } from '../services/WalletEnvelopeCodec';
import { WalletFileService } from '../services/WalletFileService';

const SALT = '00112233445566778899aabbccddeeff';
const NONCE = '00112233445566778899aabbccddeeff0011223344556677';

function envelope3(data: number[] = [0, 12, 255, 7]) {
  return {
    envelope: 3 as const,
    kdf: { alg: 'argon2id' as const, v: 19, m: 32768, t: 3, p: 1, salt: SALT },
    nonce: NONCE,
    data,
  };
}

const blockchainWallet = {
  isLocal: () => false,
  exportToRaw: () => ({
    deposits: [],
    withdrawals: [],
    transactions: [],
    lastHeight: 4,
    nonce: '',
    keys: { priv: { spend: 'spend-key', view: 'view-key' } },
    creationHeight: 50,
  }),
};

function countNonWhitespace(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c !== 0x20 && c !== 0x0a && c !== 0x0d && c !== 0x09) {
      count++;
    }
  }
  return count;
}

function trackJsonParse(): { called: boolean; restore: () => void } {
  const seen = { called: false, restore: () => undefined };
  const original = JSON.parse;
  JSON.parse = ((text: string, reviver?: (key: string, value: unknown) => unknown) => {
    seen.called = true;
    return original(text, reviver);
  }) as typeof JSON.parse;
  seen.restore = () => {
    JSON.parse = original;
  };
  return seen;
}

function capture(run: () => unknown): { threw: boolean; error?: Error } {
  try {
    run();
    return { threw: false };
  } catch (error) {
    return { threw: true, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

async function settle(run: () => unknown): Promise<{ value?: unknown; error?: Error }> {
  try {
    const value = await run();
    return { value };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}

function expectTooLarge(error: Error | undefined): void {
  expect(error).toBeInstanceOf(Error);
  expect(error?.name).toBe('WalletFileTooLargeError');
  expect(error?.message).toMatch(/too large/i);
  expect(error?.message).not.toMatch(/not valid JSON/i);
  expect(error?.message).not.toMatch(/password/i);
}

describe('WalletFileService envelope size gates and export shape', () => {
  beforeEach(() => {
    mockSaveEncryptedWallet.mockReset();
    mockOpenEncryptedWallet.mockReset();
    mockDecryptEnvelopeToRaw.mockReset();
    mockDecryptEnvelopeToRaw.mockReturnValue({
      keys: { priv: { spend: 'spend-key', view: 'view-key' } },
      creationHeight: 50,
    });
    mockOpenEncryptedWallet.mockImplementation((envelope: unknown) => {
      const obj = envelope as { encryptedKeys?: unknown; data?: unknown; envelope?: unknown };
      if (obj && typeof obj === 'object' && Array.isArray(obj.encryptedKeys) && !Array.isArray(obj.data)) {
        throw new UnsupportedWalletEnvelopeError();
      }
      if (obj && typeof obj === 'object' && 'envelope' in obj && obj.envelope !== 3) {
        throw new UnsupportedWalletEnvelopeError();
      }
      return {
        keys: { priv: { spend: 'spend-key', view: 'view-key' } },
        creationHeight: 50,
        exportToRaw: () => ({
          keys: { priv: { spend: 'spend-key', view: 'view-key' } },
          creationHeight: 50,
        }),
      };
    });
  });

  it('derives the text and JSON caps from the ciphertext byte cap', () => {
    expect(MAX_ENVELOPE_JSON_CHARS).toBe(4 * MAX_ENVELOPE_CIPHERTEXT_BYTES);
    expect(MAX_ENVELOPE_TEXT_CHARS).toBe(4 * MAX_ENVELOPE_JSON_CHARS);
  });

  it('strips a BOM before parsing an encrypted envelope', () => {
    const parsed = WalletFileService.parseEncryptedWalletFile('\uFEFF{"data":[1],"nonce":"n"}\n');
    expect(parsed).toEqual({ data: [1], nonce: 'n' });
  });

  it('rejects raw text over the text cap before JSON.parse, even when it is mostly whitespace', () => {
    const text = `{${' '.repeat(MAX_ENVELOPE_TEXT_CHARS)}}`;
    expect(text.length).toBe(MAX_ENVELOPE_TEXT_CHARS + 2);
    expect(countNonWhitespace(text)).toBe(2);

    const seen = trackJsonParse();
    try {
      const outcome = capture(() => WalletFileService.parseEncryptedWalletFile(text));
      expect(outcome.threw).toBe(true);
      expectTooLarge(outcome.error);
      expect(seen.called).toBe(false);
    } finally {
      seen.restore();
    }
  }, 120_000);

  it('rejects non-whitespace JSON over the JSON cap before JSON.parse', () => {
    const prefix = '{"data":[1],"nonce":"';
    const suffix = '"}';
    const padLen = MAX_ENVELOPE_JSON_CHARS - prefix.length;
    const text = `${prefix}${'a'.repeat(padLen)}${suffix}`;
    expect(text.length).toBeLessThan(MAX_ENVELOPE_TEXT_CHARS);
    expect(countNonWhitespace(text)).toBe(MAX_ENVELOPE_JSON_CHARS + suffix.length);

    const seen = trackJsonParse();
    try {
      const outcome = capture(() => WalletFileService.parseEncryptedWalletFile(text));
      expect(outcome.threw).toBe(true);
      expectTooLarge(outcome.error);
      expect(seen.called).toBe(false);
    } finally {
      seen.restore();
    }
  }, 120_000);

  it('accepts whitespace past the JSON cap when raw text and non-whitespace stay inside the caps', () => {
    const body = '{"data":[1],"nonce":"n"}';
    const text = `{\n${' '.repeat(MAX_ENVELOPE_JSON_CHARS)}\n"data":[1],"nonce":"n"}`;
    expect(text.length).toBeGreaterThan(MAX_ENVELOPE_JSON_CHARS);
    expect(text.length).toBeLessThanOrEqual(MAX_ENVELOPE_TEXT_CHARS);
    expect(text.trim().length).toBeGreaterThan(MAX_ENVELOPE_JSON_CHARS);
    expect(countNonWhitespace(text)).toBe(body.length);
    expect(WalletFileService.parseEncryptedWalletFile(text)).toEqual({ data: [1], nonce: 'n' });
  }, 120_000);

  it('reports invalid JSON with a different error than a too-large file', () => {
    let invalid: Error | undefined;
    try {
      WalletFileService.parseEncryptedWalletFile('{not-json');
    } catch (error) {
      invalid = error instanceof Error ? error : undefined;
    }

    expect(invalid?.name).not.toBe('WalletFileTooLargeError');
    expect(invalid?.message).toBe('Invalid wallet file: not valid JSON');
    expect(invalid?.message).not.toMatch(/too large/i);
    expect(invalid?.message).not.toMatch(/password/i);
  });

  it('rejects ciphertext longer than the cap on open instead of a wrong password', async () => {
    const data = [1, 2, 3];
    Object.defineProperty(data, 'length', { value: MAX_ENVELOPE_CIPHERTEXT_BYTES + 1 });
    expect(data.length).toBe(MAX_ENVELOPE_CIPHERTEXT_BYTES + 1);

    const outcome = await settle(() => WalletFileService.decryptWalletImport({ data, nonce: NONCE } as never, 'correct-password'));

    expectTooLarge(outcome.error);
    expect(outcome.value === undefined).toBe(true);
    expect(mockOpenEncryptedWallet).not.toHaveBeenCalled();
    expect(mockDecryptEnvelopeToRaw).not.toHaveBeenCalled();
  });

  it('does not return export text when saved ciphertext exceeds the cap', async () => {
    const data = [9];
    Object.defineProperty(data, 'length', { value: MAX_ENVELOPE_CIPHERTEXT_BYTES + 1 });
    mockSaveEncryptedWallet.mockResolvedValue(envelope3(data));

    const outcome = await settle(() => WalletFileService.createExportFileContent(blockchainWallet as never, 'file-password'));

    expect(outcome.value === undefined).toBe(true);
    expectTooLarge(outcome.error);
  });

  it('writes a pretty header with the ciphertext data array on one line', async () => {
    const saved = envelope3();
    mockSaveEncryptedWallet.mockResolvedValue(saved);

    const text = await WalletFileService.createExportFileContent(blockchainWallet as never, 'file-password');
    const lines = text.trimEnd().split('\n');
    const dataLines = lines.filter((line) => line.includes('"data"'));

    expect(mockSaveEncryptedWallet).toHaveBeenCalledWith(blockchainWallet.exportToRaw(), 'file-password');
    expect(lines[0]).toBe('{');
    expect(lines[1]).toBe('  "envelope": 3,');
    expect(lines).toContain(`  "nonce": "${NONCE}",`);
    expect(lines).toContain(`    "salt": "${SALT}"`);
    expect(dataLines).toEqual([`  "data": ${JSON.stringify(saved.data)}`]);
    expect(lines.at(-1)).toBe('}');
    expect(JSON.parse(text)).toEqual(saved);
  });

  it('propagates a password that is too long instead of returning file text', async () => {
    const rejection = Promise.reject(new RangeError('password UTF-8 length exceeds 1024 bytes'));
    rejection.catch(() => undefined);
    mockSaveEncryptedWallet.mockReturnValue(rejection);

    const outcome = await settle(() => WalletFileService.createExportFileContent(blockchainWallet as never, 'x'.repeat(1025)));

    expect(outcome.value === undefined).toBe(true);
    expect(outcome.error).toBeInstanceOf(RangeError);
    expect(outcome.error?.message).toMatch(/1024/);
  });

  it('surfaces Envelope 1 as unsupported instead of a wrong password', async () => {
    const text = JSON.stringify({ encryptedKeys: [9, 8, 7], nonce: '' });
    const outcome = await settle(() => {
      const parsed = WalletFileService.parseEncryptedWalletFile(text);
      return WalletFileService.decryptWalletImport(parsed, 'correct-password');
    });

    expect(outcome.value === undefined).toBe(true);
    expect(outcome.error).toBeInstanceOf(UnsupportedWalletEnvelopeError);
    expect((outcome.error as UnsupportedWalletEnvelopeError).code).toBe('unsupported-wallet-envelope');
    expect(outcome.error?.message).not.toMatch(/password/i);
    expect(outcome.error?.message).not.toMatch(/not valid JSON/i);
  });
});
