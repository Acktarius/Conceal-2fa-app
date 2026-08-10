/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */

import * as DocumentPicker from 'expo-document-picker';
import {
  cacheDirectory,
  readAsStringAsync,
  StorageAccessFramework,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';

/** @see openspec/changes/export-wallet-as-file/design.md — iOS share fallback, no expo-sharing in v1 */
export const WALLET_EXPORT_CANCELLED = 'USER_CANCELLED';

export const WALLET_EXPORT_SAVE_FAILED = 'Could not save wallet file to the selected folder. Please try another folder.';

function isUserCancelled(error: unknown): boolean {
  if (error instanceof Error && error.message === WALLET_EXPORT_CANCELLED) {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('cancel') || message.includes('abort') || message.includes('dismiss');
}

async function requestWalletExportDirectoryAndroid(): Promise<string> {
  let permissions;
  try {
    const downloadsUri = StorageAccessFramework.getUriForDirectoryInRoot('Download');
    permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync(downloadsUri);
  } catch (error) {
    if (isUserCancelled(error)) {
      throw new Error(WALLET_EXPORT_CANCELLED);
    }
    throw new Error(WALLET_EXPORT_SAVE_FAILED);
  }

  if (!permissions.granted) {
    throw new Error(WALLET_EXPORT_CANCELLED);
  }

  return permissions.directoryUri;
}

async function writeWalletExportToDirectoryAndroid(
  content: string,
  filename: string,
  directoryUri: string
): Promise<void> {
  try {
    const fileUri = await StorageAccessFramework.createFileAsync(directoryUri, filename, 'application/json');
    await writeAsStringAsync(fileUri, content, { encoding: 'utf8' });
  } catch (error) {
    if (isUserCancelled(error)) {
      throw new Error(WALLET_EXPORT_CANCELLED);
    }
    throw new Error(WALLET_EXPORT_SAVE_FAILED);
  }
}

async function saveWalletExportFileAndroid(content: string, filename: string): Promise<void> {
  const directoryUri = await requestWalletExportDirectoryAndroid();
  await writeWalletExportToDirectoryAndroid(content, filename, directoryUri);
}

async function saveWalletExportFileIos(content: string, filename: string): Promise<void> {
  const cachePath = `${cacheDirectory ?? ''}${filename}`;
  await writeAsStringAsync(cachePath, content, { encoding: 'utf8' });

  const shareResult = await Share.share({
    url: cachePath,
    title: filename,
  });

  if (shareResult.action === Share.dismissedAction) {
    throw new Error(WALLET_EXPORT_CANCELLED);
  }
}

/** Android: open SAF folder picker before encrypting. iOS: no directory step (share sheet at write). */
export async function requestWalletExportDirectory(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    return null;
  }
  return requestWalletExportDirectoryAndroid();
}

/** Pick an encrypted wallet backup JSON file from device storage. */
export async function pickWalletImportFile(): Promise<string> {
  const result = await DocumentPicker.getDocumentAsync({
    // Android often labels .json as application/octet-stream; */* keeps picker usable.
    type: Platform.OS === 'android' ? '*/*' : ['application/json', 'text/json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    throw new Error(WALLET_EXPORT_CANCELLED);
  }

  let content: string;
  try {
    content = await readAsStringAsync(result.assets[0].uri, { encoding: 'utf8' });
  } catch {
    throw new Error('Could not read wallet file from device storage');
  }
  content = content.replace(/^\uFEFF/, '').trim();

  try {
    JSON.parse(content);
  } catch {
    throw new Error('Invalid wallet file: not valid JSON');
  }

  return content;
}

/** Save encrypted wallet JSON; Android uses SAF (optionally pre-selected folder), iOS uses RN Share. */
export async function saveWalletExportFile(
  content: string,
  filename: string,
  directoryUri?: string | null
): Promise<void> {
  if (Platform.OS === 'android') {
    if (directoryUri) {
      await writeWalletExportToDirectoryAndroid(content, filename, directoryUri);
      return;
    }
    await saveWalletExportFileAndroid(content, filename);
    return;
  }

  await saveWalletExportFileIos(content, filename);
}
