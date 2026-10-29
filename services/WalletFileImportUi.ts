/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */

import { UnsupportedWalletEnvelopeError } from './WalletEnvelopeCodec';
import { WalletFileTooLargeError } from './WalletFileService';

const WALLET_IMPORT_WRONG_PASSWORD = 'Invalid password or corrupted wallet file';
const WALLET_IMPORT_UNSUPPORTED = 'This wallet file format is unsupported.';

/** User-facing import failure. Null from decrypt means the password did not open the file. */
export function walletImportUserMessage(error: unknown): string {
  if (error === null) {
    return WALLET_IMPORT_WRONG_PASSWORD;
  }
  if (error instanceof WalletFileTooLargeError) {
    return error.message;
  }
  if (error instanceof UnsupportedWalletEnvelopeError) {
    return WALLET_IMPORT_UNSUPPORTED;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Failed to import wallet from file';
}
