import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Same cap as raw envelope text: 4 × JSON chars, and JSON chars are 4 × ciphertext bytes. */
const MAX_ENVELOPE_CIPHERTEXT_BYTES = 8_388_608;
const MAX_WALLET_PICK_BYTES = 4 * 4 * MAX_ENVELOPE_CIPHERTEXT_BYTES;

const mockGetDocumentAsync = vi.fn();
const mockReadAsStringAsync = vi.fn();

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Share: { share: vi.fn(), sharedAction: 'sharedAction', dismissedAction: 'dismissedAction' },
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

vi.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  writeAsStringAsync: vi.fn(),
  cacheDirectory: '/cache/',
  StorageAccessFramework: {
    getUriForDirectoryInRoot: vi.fn(),
    requestDirectoryPermissionsAsync: vi.fn(),
    createFileAsync: vi.fn(),
  },
}));

import { pickWalletImportFile } from '../services/WalletFileIO';

describe('WalletFileIO pick size and text', () => {
  beforeEach(() => {
    mockGetDocumentAsync.mockReset();
    mockReadAsStringAsync.mockReset();
  });

  it('rejects a picked file larger than the byte cap before reading it', async () => {
    const size = MAX_WALLET_PICK_BYTES + 1;
    expect(size).toBeGreaterThan(MAX_WALLET_PICK_BYTES);
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/huge.json', size }],
    });
    mockReadAsStringAsync.mockResolvedValue('{"data":[1],"nonce":"n"}');

    await expect(pickWalletImportFile()).rejects.toThrow(/too large/i);
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
  });

  it('reads a file whose known size is exactly the byte cap', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/edge.json', size: MAX_WALLET_PICK_BYTES }],
    });
    mockReadAsStringAsync.mockResolvedValue('{"data":[1],"nonce":"n"}');

    const content = await pickWalletImportFile();

    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///tmp/edge.json', { encoding: 'utf8' });
    expect(content).toBe('{"data":[1],"nonce":"n"}');
  });

  it('reads a file when the picker does not report a size', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/nosize.json' }],
    });
    mockReadAsStringAsync.mockResolvedValue('{"data":[1],"nonce":"n"}');

    await expect(pickWalletImportFile()).resolves.toBe('{"data":[1],"nonce":"n"}');
    expect(mockReadAsStringAsync).toHaveBeenCalledOnce();
  });

  it('returns picked text without parsing JSON', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/notes.txt', size: 8 }],
    });
    mockReadAsStringAsync.mockResolvedValue('not json');

    await expect(pickWalletImportFile()).resolves.toBe('not json');
    expect(mockReadAsStringAsync).toHaveBeenCalledOnce();
  });
});
