import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockShow = vi.fn();
const mockHide = vi.fn();
const mockCreate = vi.fn();

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Share: { share: vi.fn(), sharedAction: 'sharedAction', dismissedAction: 'dismissedAction' },
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  cacheDirectory: '/cache/',
  StorageAccessFramework: {
    getUriForDirectoryInRoot: vi.fn(),
    requestDirectoryPermissionsAsync: vi.fn(),
    createFileAsync: vi.fn(),
  },
}));

vi.mock('../contexts/ImportProgressContext', () => ({
  getImportProgress: () => ({
    showImportProgress: mockShow,
    updateImportProgress: vi.fn(),
    hideImportProgress: mockHide,
    runWithImportProgress: vi.fn(),
  }),
}));

vi.mock('../services/WalletFileService', () => ({
  WalletFileService: {
    createExportFileContent: (...args: unknown[]) => mockCreate(...args),
  },
}));

import { createExportFileContentWithProgress, walletExportErrorMessage } from '../services/WalletFileExportUi';
import { WALLET_EXPORT_CANCELLED } from '../services/WalletFileIO';

const EXPORT_FAILED = 'Failed to export wallet file. Please try again.';
const ENCRYPTING = 'Encrypting…';

const screenSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../screens/SettingsScreen.tsx'), 'utf8');

function exportHandler(source: string): string {
  const start = source.indexOf('const handleExportWalletAsFile');
  const end = source.indexOf('const handleExportWallet =');
  if (start < 0 || end <= start) {
    throw new Error('handleExportWalletAsFile not found');
  }
  return source.slice(start, end);
}

describe('wallet file export UI', () => {
  beforeEach(() => {
    mockShow.mockReset();
    mockHide.mockReset();
    mockCreate.mockReset();
  });

  it('surfaces a 1024-byte password RangeError and still hides other password errors', () => {
    const limitBytes = 1024;
    const tooLong = new RangeError(`password UTF-8 length exceeds ${limitBytes} bytes`);
    const policy = new Error('Export password is required');

    expect(walletExportErrorMessage(tooLong)).toBe(tooLong.message);
    expect(walletExportErrorMessage(tooLong)).toContain(String(limitBytes));
    expect(walletExportErrorMessage(tooLong)).not.toBe(EXPORT_FAILED);

    expect(walletExportErrorMessage(policy)).toBe(EXPORT_FAILED);
    expect(walletExportErrorMessage(policy)).not.toBe(policy.message);

    const verified = new Error('Wallet backup could not be verified');
    expect(walletExportErrorMessage(verified)).toBe(verified.message);
    expect(walletExportErrorMessage(new Error(WALLET_EXPORT_CANCELLED))).toBeNull();
  });

  it('shows Encrypting… until the async export content resolves', async () => {
    const wallet = { id: 'export-wallet' };
    let release: (value: string) => void = () => {};
    const fileText = `envelope-text-${wallet.id}`;
    mockCreate.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        })
    );

    const pending = createExportFileContentWithProgress(wallet as never, 'file-password');
    await Promise.resolve();

    expect(mockShow).toHaveBeenCalledWith(ENCRYPTING);
    expect(mockHide).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(wallet, 'file-password');

    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    release(fileText);
    await expect(pending).resolves.toBe(fileText);
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it('hides encrypting progress when export content rejects', async () => {
    const limitBytes = 1024;
    const tooLong = new RangeError(`password UTF-8 length exceeds ${limitBytes} bytes`);
    mockCreate.mockRejectedValue(tooLong);

    await expect(createExportFileContentWithProgress({} as never, 'file-password')).rejects.toBe(tooLong);
    expect(mockShow).toHaveBeenCalledWith(ENCRYPTING);
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it('Settings export awaits file content before save and uses the failure mapper', () => {
    const fn = exportHandler(screenSource);
    const awaited = fn.indexOf('await createExportFileContentWithProgress(');
    const saveAt = fn.indexOf('saveWalletExportFile(');
    expect(awaited).toBeGreaterThanOrEqual(0);
    expect(saveAt).toBeGreaterThan(awaited);
    expect(fn).toContain('walletExportErrorMessage(');
    expect(fn).not.toContain("includes('password')");
  });
});
