import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-conceal-crypto', () => ({
  default: {},
}));

vi.mock('../config', () => ({
  config: { addressPrefix: 0x7ad4 },
}));

vi.mock('../model/Wallet', () => ({
  Wallet: class Wallet {},
}));

import { UnsupportedWalletEnvelopeError } from '../services/WalletEnvelopeCodec';
import { walletImportUserMessage } from '../services/WalletFileImportUi';
import { WalletFileService, WalletFileTooLargeError } from '../services/WalletFileService';

const WRONG_PASSWORD = 'Invalid password or corrupted wallet file';

const importServiceSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../services/ImportService.ts'), 'utf8');

function thrown(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
  }
  throw new Error('expected a throw');
}

function importFromFileSource(source: string): string {
  const start = source.indexOf('private static async importFromFile');
  const end = source.indexOf('private static async getWalletFileContentFromUser');
  if (start < 0 || end <= start) {
    throw new Error('importFromFile not found');
  }
  return source.slice(start, end);
}

describe('wallet file import user messages', () => {
  it('maps too-large, invalid JSON, unsupported format, and wrong password to distinct messages', () => {
    const tooLarge = new WalletFileTooLargeError();
    const invalidJson = thrown(() => WalletFileService.parseEncryptedWalletFile('not-json'));
    const unsupportedFile = JSON.stringify({ envelope: 1, data: [1], nonce: 'n' });
    const unsupported = thrown(() => WalletFileService.parseEncryptedWalletFile(unsupportedFile));

    expect(invalidJson).not.toBeInstanceOf(WalletFileTooLargeError);
    expect(unsupported).toBeInstanceOf(UnsupportedWalletEnvelopeError);
    expect((unsupported as UnsupportedWalletEnvelopeError).code).toBe('unsupported-wallet-envelope');

    const tooLargeMessage = walletImportUserMessage(tooLarge);
    const invalidJsonMessage = walletImportUserMessage(invalidJson);
    const unsupportedMessage = walletImportUserMessage(unsupported);
    const wrongPasswordMessage = walletImportUserMessage(null);

    expect(tooLargeMessage).toBe(tooLarge.message);
    expect(invalidJsonMessage).toBe(invalidJson.message);
    expect(invalidJsonMessage.toLowerCase()).toContain('json');

    expect(unsupportedMessage).not.toBe(unsupported.message);
    expect(unsupportedMessage.toLowerCase()).toContain('unsupported');
    expect(unsupportedMessage.toLowerCase()).toContain('format');
    expect(unsupportedMessage.toLowerCase()).not.toContain('password');
    expect(unsupportedMessage).not.toBe(wrongPasswordMessage);

    expect(wrongPasswordMessage).toBe(WRONG_PASSWORD);
    expect(new Set([tooLargeMessage, invalidJsonMessage, unsupportedMessage, wrongPasswordMessage]).size).toBe(4);
  });

  it('ImportService awaits decrypt and uses the import message mapper', () => {
    const fn = importFromFileSource(importServiceSource);
    const awaited = fn.indexOf('await WalletFileService.decryptWalletImport(');
    const nullCheck = fn.indexOf('importResult === null');
    expect(awaited).toBeGreaterThanOrEqual(0);
    expect(nullCheck).toBeGreaterThan(awaited);
    expect(fn).toContain('walletImportUserMessage(');
  });
});
