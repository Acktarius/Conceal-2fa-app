import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSaveEncryptedWallet = vi.fn();
const mockOpenEncryptedWallet = vi.fn();

vi.mock('../services/WalletEnvelopeCodec', () => ({
  WalletEnvelopeCodec: {
    saveEncryptedWallet: (...args: unknown[]) => mockSaveEncryptedWallet(...args),
    openEncryptedWallet: (...args: unknown[]) => mockOpenEncryptedWallet(...args),
  },
}));

vi.mock('../model/Wallet', () => ({
  Wallet: {},
}));

import { WalletFileService } from '../services/WalletFileService';

const saved = {
  envelope: 3 as const,
  kdf: {
    alg: 'argon2id' as const,
    v: 19,
    m: 32768,
    t: 3,
    p: 1,
    salt: '00112233445566778899aabbccddeeff',
  },
  nonce: '00112233445566778899aabbccddeeff0011223344556677',
  data: [0, 12, 255, 7],
};

const sourceRaw = {
  deposits: [],
  withdrawals: [],
  transactions: [],
  lastHeight: 9,
  nonce: '',
  keys: { priv: { spend: 'spend-real', view: 'view-real' } },
  creationHeight: 77,
};

const blockchainWallet = {
  isLocal: () => false,
  exportToRaw: () => sourceRaw,
};

function opened(spend: string, view: string, creationHeight: number) {
  return {
    keys: { priv: { spend, view } },
    creationHeight,
    exportToRaw: () => ({
      keys: { priv: { spend, view } },
      creationHeight,
    }),
  };
}

async function settle(run: () => unknown): Promise<{ value?: unknown; error?: Error }> {
  try {
    const value = await run();
    return { value };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}

describe('WalletFileService export re-open', () => {
  beforeEach(() => {
    mockSaveEncryptedWallet.mockReset();
    mockOpenEncryptedWallet.mockReset();
    mockSaveEncryptedWallet.mockResolvedValue(saved);
  });

  it('returns the envelope text when spend key, view key, and creationHeight match', async () => {
    mockOpenEncryptedWallet.mockResolvedValue(opened('spend-real', 'view-real', 77));

    const text = await WalletFileService.createExportFileContent(blockchainWallet as never, 'file-password');

    expect(typeof text).toBe('string');
    expect(JSON.parse(text)).toEqual(saved);
    expect(text).toContain(`  "data": ${JSON.stringify(saved.data)}`);
  });

  it('does not return file content when the re-opened spend key differs', async () => {
    mockOpenEncryptedWallet.mockResolvedValue(opened('spend-other', 'view-real', 77));

    const outcome = await settle(() => WalletFileService.createExportFileContent(blockchainWallet as never, 'file-password'));

    expect(outcome.value === undefined).toBe(true);
    expect(outcome.error).toBeInstanceOf(Error);
    expect(outcome.error?.message ?? '').not.toContain(JSON.stringify(saved.data));
  });

  it('does not return file content when the re-opened view key differs', async () => {
    mockOpenEncryptedWallet.mockResolvedValue(opened('spend-real', 'view-other', 77));

    const outcome = await settle(() => WalletFileService.createExportFileContent(blockchainWallet as never, 'file-password'));

    expect(outcome.value === undefined).toBe(true);
    expect(outcome.error).toBeInstanceOf(Error);
    expect(outcome.error?.message ?? '').not.toContain(JSON.stringify(saved.data));
  });

  it('does not return file content when re-opened creationHeight differs', async () => {
    mockOpenEncryptedWallet.mockResolvedValue(opened('spend-real', 'view-real', 78));

    const outcome = await settle(() => WalletFileService.createExportFileContent(blockchainWallet as never, 'file-password'));

    expect(outcome.value === undefined).toBe(true);
    expect(outcome.error).toBeInstanceOf(Error);
    expect(outcome.error?.message ?? '').not.toContain(JSON.stringify(saved.data));
  });

  it('does not return file content when the re-open returns null', async () => {
    mockOpenEncryptedWallet.mockResolvedValue(null);

    const outcome = await settle(() => WalletFileService.createExportFileContent(blockchainWallet as never, 'file-password'));

    expect(outcome.value === undefined).toBe(true);
    expect(outcome.error).toBeInstanceOf(Error);
    expect(outcome.error?.message ?? '').not.toContain(JSON.stringify(saved.data));
  });
});
