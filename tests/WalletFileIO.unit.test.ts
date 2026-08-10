import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockShare = vi.fn();
const mockGetDocumentAsync = vi.fn();
const mockReadAsStringAsync = vi.fn();
const mockWriteAsStringAsync = vi.fn();
const mockRequestDirectoryPermissionsAsync = vi.fn();
const mockCreateFileAsync = vi.fn();
const mockGetUriForDirectoryInRoot = vi.fn((folder: string) => `content://tree/${folder}`);

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Share: {
    share: (...args: unknown[]) => mockShare(...args),
    sharedAction: 'sharedAction',
    dismissedAction: 'dismissedAction',
  },
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

vi.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  cacheDirectory: '/cache/',
  StorageAccessFramework: {
    getUriForDirectoryInRoot: (...args: unknown[]) => mockGetUriForDirectoryInRoot(...args),
    requestDirectoryPermissionsAsync: (...args: unknown[]) => mockRequestDirectoryPermissionsAsync(...args),
    createFileAsync: (...args: unknown[]) => mockCreateFileAsync(...args),
  },
}));

import {
  pickWalletImportFile,
  requestWalletExportDirectory,
  saveWalletExportFile,
  WALLET_EXPORT_CANCELLED,
  WALLET_EXPORT_SAVE_FAILED,
} from '../services/WalletFileIO';

describe('WalletFileIO pickWalletImportFile', () => {
  beforeEach(() => {
    mockGetDocumentAsync.mockReset();
    mockReadAsStringAsync.mockReset();
  });

  it('reads and normalizes selected JSON file', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/wallet.json' }],
    });
    mockReadAsStringAsync.mockResolvedValue('\uFEFF{"data":[1],"nonce":"n"}\n');

    const content = await pickWalletImportFile();

    expect(content).toBe('{"data":[1],"nonce":"n"}');
    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///tmp/wallet.json', { encoding: 'utf8' });
  });

  it('throws USER_CANCELLED when picker is dismissed', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });

    await expect(pickWalletImportFile()).rejects.toThrow(WALLET_EXPORT_CANCELLED);
  });

  it('rejects non-JSON file content', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/bad.txt' }],
    });
    mockReadAsStringAsync.mockResolvedValue('not json');

    await expect(pickWalletImportFile()).rejects.toThrow('Invalid wallet file: not valid JSON');
  });
});

describe('WalletFileIO requestWalletExportDirectory (Android)', () => {
  beforeEach(() => {
    mockRequestDirectoryPermissionsAsync.mockReset();
    mockGetUriForDirectoryInRoot.mockClear();
  });

  it('returns directory URI when folder access is granted', async () => {
    mockRequestDirectoryPermissionsAsync.mockResolvedValue({
      granted: true,
      directoryUri: 'content://tree/downloads',
    });

    const directoryUri = await requestWalletExportDirectory();

    expect(directoryUri).toBe('content://tree/downloads');
    expect(mockGetUriForDirectoryInRoot).toHaveBeenCalledWith('Download');
    expect(mockCreateFileAsync).not.toHaveBeenCalled();
  });

  it('throws USER_CANCELLED when folder access is denied', async () => {
    mockRequestDirectoryPermissionsAsync.mockResolvedValue({ granted: false, directoryUri: '' });

    await expect(requestWalletExportDirectory()).rejects.toThrow(WALLET_EXPORT_CANCELLED);
  });
});

describe('WalletFileIO saveWalletExportFile (Android)', () => {
  beforeEach(() => {
    mockShare.mockReset();
    mockRequestDirectoryPermissionsAsync.mockReset();
    mockCreateFileAsync.mockReset();
    mockWriteAsStringAsync.mockReset();
    mockGetUriForDirectoryInRoot.mockClear();
  });

  it('writes via SAF when folder access is granted', async () => {
    mockRequestDirectoryPermissionsAsync.mockResolvedValue({
      granted: true,
      directoryUri: 'content://tree/downloads',
    });
    mockCreateFileAsync.mockResolvedValue('content://file/wallet.json');
    mockWriteAsStringAsync.mockResolvedValue(undefined);

    await saveWalletExportFile('{"data":[1]}', '2fa-wallet-2026-08-09-133412.json');

    expect(mockGetUriForDirectoryInRoot).toHaveBeenCalledWith('Download');
    expect(mockRequestDirectoryPermissionsAsync).toHaveBeenCalledWith('content://tree/Download');
    expect(mockCreateFileAsync).toHaveBeenCalledWith(
      'content://tree/downloads',
      '2fa-wallet-2026-08-09-133412.json',
      'application/json'
    );
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('content://file/wallet.json', '{"data":[1]}', {
      encoding: 'utf8',
    });
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('writes to pre-selected directory without opening picker again', async () => {
    mockCreateFileAsync.mockResolvedValue('content://file/wallet.json');
    mockWriteAsStringAsync.mockResolvedValue(undefined);

    await saveWalletExportFile('{"data":[1]}', '2fa-wallet-2026-08-09-133412.json', 'content://tree/downloads');

    expect(mockRequestDirectoryPermissionsAsync).not.toHaveBeenCalled();
    expect(mockCreateFileAsync).toHaveBeenCalledWith(
      'content://tree/downloads',
      '2fa-wallet-2026-08-09-133412.json',
      'application/json'
    );
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('content://file/wallet.json', '{"data":[1]}', {
      encoding: 'utf8',
    });
  });

  it('throws USER_CANCELLED when folder access is denied', async () => {
    mockRequestDirectoryPermissionsAsync.mockResolvedValue({ granted: false, directoryUri: '' });

    await expect(saveWalletExportFile('{}', 'wallet.json')).rejects.toThrow(WALLET_EXPORT_CANCELLED);
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('does not fall back to Share when SAF write fails', async () => {
    mockRequestDirectoryPermissionsAsync.mockResolvedValue({
      granted: true,
      directoryUri: 'content://tree/downloads',
    });
    mockCreateFileAsync.mockRejectedValue(new Error('create failed'));

    await expect(saveWalletExportFile('{}', 'wallet.json')).rejects.toThrow(WALLET_EXPORT_SAVE_FAILED);
    expect(mockShare).not.toHaveBeenCalled();
  });
});
