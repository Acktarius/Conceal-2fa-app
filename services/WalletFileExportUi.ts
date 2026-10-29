/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */

import { getImportProgress } from '../contexts/ImportProgressContext';
import type { Wallet } from '../model/Wallet';
import { WALLET_EXPORT_CANCELLED } from './WalletFileIO';
import { WalletFileService } from './WalletFileService';

const WALLET_EXPORT_FAILED = 'Failed to export wallet file. Please try again.';
const EXPORT_ENCRYPTING_MESSAGE = 'Encrypting…';

/** User-visible export failure. Null means the user cancelled and no alert is shown. */
export function walletExportErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message === WALLET_EXPORT_CANCELLED) {
    return null;
  }
  if (error instanceof RangeError && error.message) {
    return error.message;
  }
  if (error instanceof Error && error.message && !error.message.includes('password')) {
    return error.message;
  }
  return WALLET_EXPORT_FAILED;
}

/** Awaits Envelope 3 export while the import-progress overlay says Encrypting…. */
export async function createExportFileContentWithProgress(wallet: Wallet, password: string): Promise<string> {
  const progress = getImportProgress();
  progress.showImportProgress(EXPORT_ENCRYPTING_MESSAGE);
  try {
    return await WalletFileService.createExportFileContent(wallet, password);
  } finally {
    progress.hideImportProgress();
  }
}
