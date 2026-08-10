/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getAppAlertContext } from '../contexts/AppAlertContext';
import { getImportProgress } from '../contexts/ImportProgressContext';
import { BlockchainExplorerRpcDaemon } from '../model/blockchain/BlockchainExplorerRPCDaemon';
import { Cn, CnUtils } from '../model/Cn';
import { CoinUri } from '../model/CoinUri';
import { KeysRepository } from '../model/KeysRepository';
import { Mnemonic } from '../model/Mnemonic';
import type { Wallet } from '../model/Wallet';
import { WalletRepository } from '../model/WalletRepository';
import { BiometricService } from './BiometricService';
import { dependencyContainer } from './DependencyContainer';
import { getGlobalWorkletLogging } from './interfaces/IWorkletLogging';
import { SmartMessageService } from './SmartMessageService';
import { StorageService } from './StorageService';
import { pickWalletImportFile, WALLET_EXPORT_CANCELLED } from './WalletFileIO';
import { WALLET_FILE_IMPORT_NOTE, WalletFileService } from './WalletFileService';
import { WalletStorageManager } from './WalletStorageManager';
// Removed WalletService import to break require cycle

export class ImportService {
  private static blockchainExplorer: BlockchainExplorerRpcDaemon | null = null;

  private static logFailure(context: string): void {
    try {
      getGlobalWorkletLogging().logging1string(`ImportService: ${context}`);
    } catch {
      // worklet logging unavailable
    }
  }

  private static async showImportSuccessAlert(message: string): Promise<void> {
    await getAppAlertContext().showMessageAlert('Wallet Imported', message);
  }

  private static async showImportErrorAlert(message: string): Promise<void> {
    await getAppAlertContext().showMessageAlert('Import Error', message);
  }

  /** Optional trusted payment ID before 2FA replay/scan so tiles are not marked unknown. */
  private static async promptImportPaymentIdIfNeeded(): Promise<void> {
    const settings = await StorageService.getSettings();
    const existing = settings.paymentIdWhiteList;
    if (Array.isArray(existing) && existing.length > 0) {
      return;
    }

    const paymentId = await getAppAlertContext().showTextInputAlert(
      'Trusted Payment ID',
      'Add a payment ID you use for 2FA smart messages. Services from this source will not show the unknown-source warning.',
      {
        placeholder: '64-character hex payment ID',
        confirmLabel: 'Add',
        skipLabel: 'Skip',
        validate: (value) => {
          if (!value) {
            return 'Please enter a payment ID';
          }
          if (!CnUtils.validatePaymentId(value)) {
            return 'Payment ID must be exactly 64 hexadecimal characters';
          }
          return null;
        },
      }
    );

    if (!paymentId) {
      return;
    }

    await StorageService.saveSettings({
      ...settings,
      paymentIdWhiteList: [paymentId],
    });
  }

  private static async pickImportMethod(): Promise<'mnemonic' | 'qr' | 'file' | 'cancel'> {
    const choice = await getAppAlertContext().showChoiceAlert('Import Method', 'How would you like to import your wallet?', [
      { label: 'From File', value: 'file', variant: 'primary' },
      { label: 'Seed Phrase', value: 'mnemonic' },
      { label: 'QR Code', value: 'qr' },
      { label: 'Cancel', value: 'cancel', variant: 'cancel' },
    ]);
    if (choice === 'file' || choice === 'mnemonic' || choice === 'qr') {
      return choice;
    }
    return 'cancel';
  }

  static async importWallet(cachedWallet?: Wallet | null): Promise<Wallet> {
    try {
      // First, initialize blockchain explorer if needed
      if (!ImportService.blockchainExplorer) {
        ImportService.blockchainExplorer = new BlockchainExplorerRpcDaemon();
        await ImportService.blockchainExplorer.initialize();
      }

      while (true) {
        // Loop to allow returning to method selection on cancel
        try {
          // Let user choose import method
          const importMethod = await ImportService.pickImportMethod();

          if (importMethod === 'cancel') {
            throw new Error('USER_CANCELLED');
          }

          if (importMethod === 'mnemonic') {
            return await ImportService.importFromMnemonic(cachedWallet);
          }
          if (importMethod === 'file') {
            return await ImportService.importFromFile(cachedWallet);
          }
          return await ImportService.importFromQR(cachedWallet);
        } catch (error) {
          if (error instanceof Error && error.message === 'USER_CANCELLED') {
            throw error; // Propagate cancel up to wallet creation
          }
          const message = error instanceof Error ? error.message : 'Failed to import wallet';
          await ImportService.showImportErrorAlert(message);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_CANCELLED') {
        throw error; // Propagate cancel up to wallet creation
      }
      ImportService.logFailure('wallet import failed');
      throw new Error('Failed to import wallet');
    }
  }

  private static async resolveExistingWallet(cachedWallet?: Wallet | null): Promise<Wallet> {
    if (cachedWallet) {
      return cachedWallet;
    }

    const existingWallet = await WalletStorageManager.getWallet();
    if (!existingWallet) {
      throw new Error('No existing wallet found to upgrade');
    }

    return existingWallet;
  }

  private static async importFromMnemonic(cachedWallet?: Wallet | null): Promise<Wallet> {
    try {
      // Get current blockchain height
      const currentHeight = await ImportService.blockchainExplorer!.getHeight();

      // Get mnemonic and creation height from user using our custom modal
      const { mnemonicSeed, providedHeight } = await ImportService.getMnemonicFromUser();

      // Detect language and decode mnemonic
      const detectedMnemonicLang = Mnemonic.detectLang(mnemonicSeed.trim());
      if (!detectedMnemonicLang) {
        throw new Error('Could not detect mnemonic language');
      }

      const mnemonic_decoded = Mnemonic.mn_decode(mnemonicSeed.trim(), detectedMnemonicLang);
      if (!mnemonic_decoded) {
        throw new Error('Invalid mnemonic phrase');
      }

      // Create keys from mnemonic
      const keys = Cn.create_address(mnemonic_decoded);

      const existingWallet = await ImportService.resolveExistingWallet(cachedWallet);

      // Upgrade the existing wallet with blockchain keys
      existingWallet.keys = KeysRepository.fromPriv(keys.spend.sec, keys.view.sec);

      // Calculate creation height based on user input
      let creationHeight = 0;
      if (providedHeight > 0) {
        const assumeCreationHeight = Math.max(0, providedHeight - 10);
        if (assumeCreationHeight < 0) {
          creationHeight = 0;
        } else if (assumeCreationHeight > currentHeight) {
          creationHeight = currentHeight;
        } else {
          creationHeight = assumeCreationHeight;
        }
      }

      existingWallet.creationHeight = creationHeight;
      existingWallet.lastHeight = creationHeight;

      await ImportService.promptImportPaymentIdIfNeeded();
      await ImportService.saveImportedWallet(existingWallet);

      return existingWallet;
    } catch {
      ImportService.logFailure('mnemonic import failed');
      throw new Error('Failed to import wallet from mnemonic');
    }
  }

  private static async restoreNodePreferenceFromImportedWallet(wallet: Wallet): Promise<void> {
    const options = wallet.options;
    if (options?.customNode && options.nodeUrl?.trim()) {
      await WalletStorageManager.setCustomNode(options.nodeUrl.trim());
      return;
    }
    await WalletStorageManager.clearCustomNode();
  }

  private static async importFromFile(_cachedWallet?: Wallet | null): Promise<Wallet> {
    try {
      const appAuthenticated = await WalletStorageManager.authenticateForSensitiveAction();
      if (!appAuthenticated) {
        throw new Error('USER_CANCELLED');
      }

      const fileContent = await ImportService.getWalletFileContentFromUser();
      const envelope = WalletFileService.parseEncryptedWalletFile(fileContent);

      const passwordPromptContext = (global as any).passwordPromptContext;
      if (!passwordPromptContext) {
        throw new Error('Password prompt context not available');
      }

      let filePassword = await passwordPromptContext.showPasswordPromptAlert(
        'Wallet File Password',
        'Enter the password used to encrypt this wallet backup file (not your app unlock password):'
      );
      if (!filePassword) {
        throw new Error('USER_CANCELLED');
      }

      let importResult: ReturnType<typeof WalletFileService.decryptWalletImport> = null;
      const importProgress = getImportProgress();
      try {
        importProgress.showImportProgress('Decrypting backup…');
        try {
          importResult = WalletFileService.decryptWalletImport(envelope, filePassword);
        } finally {
          filePassword = '';
        }
      } finally {
        importProgress.hideImportProgress();
      }

      if (importResult === null) {
        throw new Error('Invalid password or corrupted wallet file');
      }

      const { wallet: importedWallet, raw: importedRaw } = importResult;

      if (importedWallet.isLocal()) {
        throw new Error('Backup file does not contain a blockchain wallet');
      }

      await ImportService.promptImportPaymentIdIfNeeded();

      let replayResult: Awaited<ReturnType<typeof SmartMessageService.replaySharedKeysFromWallet>>;
      try {
        importProgress.showImportProgress('Restoring 2FA services…');
        replayResult = await SmartMessageService.replaySharedKeysFromWallet(importedWallet, importedRaw, (processed, total) => {
          if (total > 0) {
            importProgress.updateImportProgress(`Restoring 2FA services (${processed}/${total})…`);
          }
        });
        await ImportService.restoreNodePreferenceFromImportedWallet(importedWallet);
      } finally {
        importProgress.hideImportProgress();
      }

      dependencyContainer.getWalletOperations().triggerSharedKeysRefresh();

      await ImportService.saveImportedWallet(importedWallet);

      const importNote =
        replayResult.servicesRestored > 0
          ? `Wallet restored from backup. Restored ${replayResult.servicesRestored} 2FA service(s) from transaction history.`
          : replayResult.messagesProcessed > 0
            ? 'Wallet restored from backup. On-chain 2FA messages were processed; no active services remain (all may have been deleted).'
            : WALLET_FILE_IMPORT_NOTE;
      await ImportService.showImportSuccessAlert(importNote);
      return importedWallet;
    } catch (error) {
      if (error instanceof Error && (error.message === 'USER_CANCELLED' || error.message === WALLET_EXPORT_CANCELLED)) {
        throw new Error('USER_CANCELLED');
      }
      ImportService.logFailure('file import failed');
      throw error instanceof Error ? error : new Error('Failed to import wallet from file');
    }
  }

  private static async getWalletFileContentFromUser(): Promise<string> {
    if (Platform.OS !== 'web') {
      return pickWalletImportFile();
    }

    return new Promise((resolve, reject) => {
      const walletFileInputContext = (global as any).walletFileInputContext;
      if (!walletFileInputContext) {
        reject(new Error('Wallet file input context not available. App must be properly initialized.'));
        return;
      }

      walletFileInputContext.showWalletFileInputModal(
        (fileContent: string) => resolve(fileContent),
        () => reject(new Error('USER_CANCELLED'))
      );
    });
  }

  private static async importFromQR(cachedWallet?: Wallet | null): Promise<Wallet> {
    try {
      // Get current blockchain height
      const currentHeight = await ImportService.blockchainExplorer!.getHeight();
      console.log('IMPORT: Current height:', currentHeight);
      // Get QR data using our custom scanner
      const qrResult = await ImportService.getQRFromUser();
      const txDetails = CoinUri.decodeWallet(qrResult);

      if (!txDetails || !txDetails.spendKey) {
        throw new Error('Invalid QR code format - spend key required');
      }

      // Extract keys from QR code (focus on keys, not mnemonic)
      let keys;

      if (txDetails.spendKey) {
        let viewkey = txDetails.viewKey || '';
        if (viewkey === '') {
          viewkey = Cn.generate_keys(CnUtils.cn_fast_hash(txDetails.spendKey)).sec;
        }

        keys = KeysRepository.fromPriv(txDetails.spendKey, viewkey);
      } else if (txDetails.viewKey && txDetails.address) {
        const decodedPublic = Cn.decode_address(txDetails.address);
        keys = {
          priv: {
            spend: '',
            view: txDetails.viewKey,
          },
          pub: {
            spend: decodedPublic.spend,
            view: decodedPublic.view,
          },
        };
      } else {
        throw new Error('Invalid QR code data - spend key is required');
      }

      const existingWallet = await ImportService.resolveExistingWallet(cachedWallet);

      // Upgrade the existing wallet with blockchain keys
      existingWallet.keys = keys;

      // Use provided height or default to current height - 10
      const height = txDetails.height ? parseInt(txDetails.height.toString()) : Math.max(0, currentHeight - 10);
      existingWallet.creationHeight = height;
      existingWallet.lastHeight = height;

      console.log(
        'QR IMPORT: Set wallet heights - creationHeight:',
        existingWallet.creationHeight,
        'lastHeight:',
        existingWallet.lastHeight
      );

      // Update the cached wallet instance with imported data (no re-authentication needed)
      // Note: WalletService will handle this via the returned wallet
      console.log('IMPORT: Wallet ready for caching with imported data');

      // Encrypt and save the upgraded wallet based on current authentication mode
      await ImportService.promptImportPaymentIdIfNeeded();
      await ImportService.saveImportedWallet(existingWallet);

      return existingWallet;
    } catch (error) {
      console.error('Error importing from QR:', error);
      throw error;
    }
  }

  private static async getMnemonicFromUser(): Promise<{ mnemonicSeed: string; providedHeight: number }> {
    return new Promise((resolve, reject) => {
      // Get the seed input context from global state
      const seedInputContext = (global as any).seedInputContext;

      if (!seedInputContext) {
        throw new Error('Seed input context not available. App must be properly initialized.');
      }

      // Use our custom modal
      seedInputContext.showSeedInputModal(
        (seedPhrase: string, creationHeight?: number) => {
          resolve({ mnemonicSeed: seedPhrase, providedHeight: creationHeight || 0 });
        },
        () => {
          reject(new Error('USER_CANCELLED'));
        }
      );
    });
  }

  private static async resolvePasswordEncryptionKey(password: string): Promise<string> {
    const verifiedKey = await WalletStorageManager.verifyPasswordAndGetKey(password);
    if (verifiedKey) {
      WalletStorageManager.setCurrentSessionPasswordKey(verifiedKey);
      return verifiedKey;
    }

    const derivedKey = await WalletStorageManager.derivePasswordKey(password);
    const decrypted = await WalletStorageManager.getDecryptedWalletWithDerivedKey(derivedKey);
    if (!decrypted) {
      throw new Error('Incorrect wallet password');
    }

    await WalletStorageManager.storePersistentPasswordKey(password);
    WalletStorageManager.setCurrentSessionPasswordKey(derivedKey);
    return derivedKey;
  }

  private static async saveImportedWallet(wallet: Wallet): Promise<void> {
    try {
      let encryptionKey: string | null = null;

      if (await BiometricService.isBiometricChecked()) {
        const authenticated = await BiometricService.authenticateWithBiometric();
        if (!authenticated) {
          throw new Error('Biometric authentication required to secure imported wallet');
        }
        encryptionKey = await WalletStorageManager.deriveBiometricKey();
        if (!encryptionKey) {
          throw new Error('Failed to derive biometric key for imported wallet encryption');
        }
      } else {
        encryptionKey = await WalletStorageManager.getAvailablePasswordEncryptionKey();
        if (!encryptionKey) {
          const passwordPromptContext = (global as any).passwordPromptContext;
          if (!passwordPromptContext) {
            throw new Error('Password prompt context not available');
          }

          const password = await passwordPromptContext.showPasswordPromptAlert(
            'Wallet Password Required',
            'Enter your wallet password to save the imported wallet:'
          );

          if (!password) {
            throw new Error('Password required to secure imported wallet');
          }

          encryptionKey = await ImportService.resolvePasswordEncryptionKey(password);
        }
      }

      const encryptedWallet = WalletRepository.save(wallet, encryptionKey);
      await WalletStorageManager.saveEncryptedWalletData(encryptedWallet);

      if (!(await BiometricService.isBiometricChecked())) {
        await SecureStore.setItemAsync('wallet_has_password', 'true');
      }
    } catch (error) {
      ImportService.logFailure('save imported wallet failed');
      throw error;
    }
  }

  private static async getQRFromUser(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Get the QR input context from global state
      const qrInputContext = (global as any).qrInputContext;

      if (!qrInputContext) {
        throw new Error('QR input context not available. App must be properly initialized.');
      }

      // Use our custom QR scanner modal
      qrInputContext.showQRScannerModal(
        (qrData: string) => {
          resolve(qrData);
        },
        () => {
          reject(new Error('USER_CANCELLED'));
        }
      );
    });
  }
}
