import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSaveEncryptedWallet = vi.fn();
const mockOpenEncryptedWallet = vi.fn();

vi.mock('../services/WalletEnvelopeCodec', () => ({
  WalletEnvelopeCodec: {
    saveEncryptedWallet: (...args: unknown[]) => mockSaveEncryptedWallet(...args),
    openEncryptedWallet: (...args: unknown[]) => mockOpenEncryptedWallet(...args),
  },
}));

import { WalletFileService } from '../services/WalletFileService';

describe('WalletFileService', () => {
  const blockchainWallet = {
    isLocal: () => false,
    exportToRaw: () => ({
      deposits: [],
      withdrawals: [],
      transactions: [],
      lastHeight: 0,
      nonce: '',
      keys: { priv: { spend: 'spend', view: 'view' } },
    }),
  };

  const localWallet = {
    isLocal: () => true,
  };

  beforeEach(() => {
    mockSaveEncryptedWallet.mockReset();
    mockOpenEncryptedWallet.mockReset();
    mockSaveEncryptedWallet.mockReturnValue({
      data: [1, 2, 3],
      nonce: 'AAAAAAAAAAAAAAAAAAAAAA==',
    });
    mockOpenEncryptedWallet.mockImplementation((_envelope, password) =>
      password === 'correct-password'
        ? ({
            keys: { priv: { spend: 'spend-key', view: 'view-key' } },
            creationHeight: 100,
            lastHeight: 120,
          } as never)
        : null
    );
  });

  it('builds dated export filename with time suffix', () => {
    const filename = WalletFileService.buildExportFilename(new Date(2026, 7, 9, 13, 34, 12));
    expect(filename).toBe('2fa-wallet-2026-08-09-133412.json');
  });

  it('delegates encryption to WalletEnvelopeCodec and serializes envelope', () => {
    const content = WalletFileService.createExportFileContent(blockchainWallet as never, 'file-password');

    expect(mockSaveEncryptedWallet).toHaveBeenCalledWith(blockchainWallet.exportToRaw(), 'file-password');
    expect(JSON.parse(content)).toEqual({
      data: [1, 2, 3],
      nonce: 'AAAAAAAAAAAAAAAAAAAAAA==',
    });
  });

  it('parses and decrypts via WalletEnvelopeCodec', () => {
    const envelope = { data: [9, 8, 7], nonce: 'AAAAAAAAAAAAAAAAAAAAAA==' };
    const content = JSON.stringify(envelope);

    const parsed = WalletFileService.parseEncryptedWalletFile(content);
    const decrypted = WalletFileService.decryptWalletFromFile(parsed, 'correct-password');

    expect(mockOpenEncryptedWallet).toHaveBeenCalledWith(envelope, 'correct-password');
    expect(decrypted?.keys.priv.spend).toBe('spend-key');
  });

  it('returns null for wrong export password', () => {
    const content = WalletFileService.createExportFileContent(blockchainWallet as never, 'correct-password');
    const envelope = WalletFileService.parseEncryptedWalletFile(content);

    expect(WalletFileService.decryptWalletFromFile(envelope, 'wrong-password')).toBeNull();
  });

  it('rejects invalid wallet file JSON', () => {
    expect(() => WalletFileService.parseEncryptedWalletFile('{not-json')).toThrow('Invalid wallet file: not valid JSON');
  });

  it('rejects wallet file without encrypted envelope', () => {
    expect(() => WalletFileService.parseEncryptedWalletFile('{"foo":"bar"}')).toThrow('Invalid wallet file: missing encrypted wallet data');
  });

  it('rejects export for local-only wallet', () => {
    expect(() => WalletFileService.createExportFileContent(localWallet as never, 'password')).toThrow('Cannot export local-only wallet');
    expect(mockSaveEncryptedWallet).not.toHaveBeenCalled();
  });

  it('rejects empty export password', () => {
    expect(() => WalletFileService.createExportFileContent(blockchainWallet as never, '')).toThrow('Export password is required');
  });
});
