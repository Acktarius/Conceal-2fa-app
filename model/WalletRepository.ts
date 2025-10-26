/*
 * Copyright (c) 2018 Gnock
 * Copyright (c) 2018-2019 The Masari Project
 * Copyright (c) 2018-2020 The Karbo developers
 * Copyright (c) 2018-2025 Conceal Community, Conceal.Network & Conceal Devs
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import concealCrypto from 'react-native-conceal-crypto';
import { getGlobalWorkletLogging } from '../services/interfaces/IWorkletLogging';
import { CoinUri } from './CoinUri';
import { type RawFullyEncryptedWallet, type RawWallet, Wallet } from './Wallet';

export class WalletRepository {
  // Note: Storage methods are handled by WalletStorageManager in React Native

  static decodeWithPassword(rawWallet: RawWallet | RawFullyEncryptedWallet, password: string): Wallet | null {
    if (password.length > 32) password = password.slice(0, 32);
    if (password.length < 32) {
      password = ('00000000000000000000000000000000' + password).slice(-32);
    }
    let privKey = new (<any>TextEncoder)('utf8').encode(password);

    // fix cyrillic (non-latin) passwords
    if (privKey.length > 32) {
      privKey = privKey.slice(-32);
    }

    //console.log('open wallet with nonce', rawWallet.nonce);
    // Decode the base64 nonce back to bytes
    let nonceBytes;
    try {
      // Try to decode base64 to get the original 24-byte nonce
      nonceBytes = Uint8Array.from(atob(rawWallet.nonce), (c) => c.charCodeAt(0));
    } catch (e) {
      // Fallback to the old method if base64 decode fails
      nonceBytes = new (<any>TextEncoder)('utf8').encode(rawWallet.nonce);
    }
    const nonce = nonceBytes;

    let decodedRawWallet = null;

    //detect if old type or new type of wallet
    if (typeof (<any>rawWallet).data !== 'undefined') {
      //RawFullyEncryptedWallet
      //console.log('new wallet format');
      const rawFullyEncrypted: RawFullyEncryptedWallet = <any>rawWallet;
      const encrypted = new Uint8Array(<any>rawFullyEncrypted.data);

      // Decrypt wallet using native secretbox
      let decrypted: Uint8Array | null;
      try {
        // Optimized ArrayBuffer preparation - avoid copy if already aligned
        const encryptedBuffer =
          encrypted.byteOffset === 0 && encrypted.byteLength === encrypted.buffer.byteLength
            ? (encrypted.buffer as ArrayBuffer)
            : (() => {
                const buf = new ArrayBuffer(encrypted.length);
                new Uint8Array(buf).set(encrypted);
                return buf;
              })();

        const nonceBuffer =
          nonce.byteOffset === 0 && nonce.byteLength === nonce.buffer.byteLength
            ? (nonce.buffer as ArrayBuffer)
            : (() => {
                const buf = new ArrayBuffer(nonce.length);
                new Uint8Array(buf).set(nonce);
                return buf;
              })();

        const keyBuffer =
          privKey.byteOffset === 0 && privKey.byteLength === privKey.buffer.byteLength
            ? (privKey.buffer as ArrayBuffer)
            : (() => {
                const buf = new ArrayBuffer(privKey.length);
                new Uint8Array(buf).set(privKey);
                return buf;
              })();

        const result = concealCrypto.secretboxOpen(encryptedBuffer, nonceBuffer, keyBuffer);
        decrypted = result ? new Uint8Array(result) : null;
      } catch (error) {
        console.warn('Native secretboxOpen failed, using nacl fallback:', error);
        decrypted = nacl.secretbox.open(encrypted, nonce, privKey);
      }

      if (decrypted === null) return null;

      try {
        decodedRawWallet = JSON.parse(new TextDecoder('utf8').decode(decrypted));
      } catch (e) {
        decodedRawWallet = null;
      }
    } else {
      //RawWallet
      //console.log('old wallet format');
      const oldRawWallet: RawWallet = <any>rawWallet;
      const encrypted = new Uint8Array(<any>oldRawWallet.encryptedKeys);

      // Decrypt old wallet format using native secretbox
      let decrypted: Uint8Array | null;
      try {
        // Optimized ArrayBuffer preparation - avoid copy if already aligned
        const encryptedBuffer =
          encrypted.byteOffset === 0 && encrypted.byteLength === encrypted.buffer.byteLength
            ? (encrypted.buffer as ArrayBuffer)
            : (() => {
                const buf = new ArrayBuffer(encrypted.length);
                new Uint8Array(buf).set(encrypted);
                return buf;
              })();

        const nonceBuffer =
          nonce.byteOffset === 0 && nonce.byteLength === nonce.buffer.byteLength
            ? (nonce.buffer as ArrayBuffer)
            : (() => {
                const buf = new ArrayBuffer(nonce.length);
                new Uint8Array(buf).set(nonce);
                return buf;
              })();

        const keyBuffer =
          privKey.byteOffset === 0 && privKey.byteLength === privKey.buffer.byteLength
            ? (privKey.buffer as ArrayBuffer)
            : (() => {
                const buf = new ArrayBuffer(privKey.length);
                new Uint8Array(buf).set(privKey);
                return buf;
              })();

        const result = concealCrypto.secretboxOpen(encryptedBuffer, nonceBuffer, keyBuffer);
        decrypted = result ? new Uint8Array(result) : null;
      } catch (error) {
        console.warn('Native secretboxOpen failed (old format), using nacl fallback:', error);
        decrypted = nacl.secretbox.open(encrypted, nonce, privKey);
      }

      if (decrypted === null) return null;

      oldRawWallet.encryptedKeys = new TextDecoder('utf8').decode(decrypted);
      decodedRawWallet = oldRawWallet;
    }

    if (decodedRawWallet !== null) {
      console.log('WALLET REPO: Decoded raw wallet keys:', {
        hasKeys: !!decodedRawWallet.keys,
        hasSpendKey: !!decodedRawWallet.keys?.priv?.spend,
        hasViewKey: !!decodedRawWallet.keys?.priv?.view,
        spendKeyLength: decodedRawWallet.keys?.priv?.spend?.length || 0,
        viewKeyLength: decodedRawWallet.keys?.priv?.view?.length || 0,
        creationHeight: decodedRawWallet.creationHeight,
        lastHeight: decodedRawWallet.lastHeight,
      });

      const wallet = Wallet.loadFromRaw(decodedRawWallet);

      console.log('WALLET REPO: Loaded wallet keys:', {
        hasKeys: !!wallet.keys,
        hasSpendKey: !!wallet.keys?.priv?.spend,
        hasViewKey: !!wallet.keys?.priv?.view,
        spendKeyLength: wallet.keys?.priv?.spend?.length || 0,
        viewKeyLength: wallet.keys?.priv?.view?.length || 0,
        address: wallet.getPublicAddress(),
        isLocal: wallet.isLocal(),
        creationHeight: wallet.creationHeight,
        lastHeight: wallet.lastHeight,
      });

      // Debug actual key values loaded
      /*
			if (wallet.keys?.priv?.spend) {
				console.log('WALLET REPO: Spend key value after load:', wallet.keys.priv.spend);
			}
			if (wallet.keys?.priv?.view) {
				console.log('WALLET REPO: View key value after load:', wallet.keys.priv.view);
			}
			*/
      if (wallet.coinAddressPrefix !== config.addressPrefix) return null;
      return wallet;
    }
    return null;
  }

  static getLocalWalletWithPassword(password: string, walletData: any): Wallet | null {
    if (walletData !== null) {
      return WalletRepository.decodeWithPassword(walletData, password);
    }
    return null;
  }

  static decodeWithoutPassword(rawWallet: RawWallet | RawFullyEncryptedWallet, biometricPassword: string): Wallet | null {
    // For biometric wallets, use the stored biometric password for decryption
    // The wallet data is still encrypted, but the password is retrieved from biometric storage
    return WalletRepository.decodeWithPassword(rawWallet, biometricPassword);
  }

  static save(wallet: Wallet, password: string): RawFullyEncryptedWallet {
    // Debug wallet keys before saving
    /*
		console.log('WALLET REPO: Wallet keys before save:', {
			hasKeys: !!wallet.keys,
			hasSpendKey: !!wallet.keys?.priv?.spend,
			hasViewKey: !!wallet.keys?.priv?.view,
			spendKeyLength: wallet.keys?.priv?.spend?.length || 0,
			viewKeyLength: wallet.keys?.priv?.view?.length || 0,
			address: wallet.getPublicAddress(),
			isLocal: wallet.isLocal()
		});
		*/

    return WalletRepository.getEncrypted(wallet, password);
  }

  static getEncrypted(wallet: Wallet, password: string): RawFullyEncryptedWallet {
    console.log('WALLET REPO: getEncrypted starting');
    if (password.length > 32) password = password.slice(0, 32);
    if (password.length < 32) {
      password = ('00000000000000000000000000000000' + password).slice(-32);
    }
    getGlobalWorkletLogging().logging1string1number('WALLET REPO: Password normalized to length:', password.length);
    //console.log('WALLET REPO: Password normalized to length:', password.length);

    let privKey = new (<any>TextEncoder)('utf8').encode(password);
    getGlobalWorkletLogging().logging1string1number('WALLET REPO: privKey created, length:', privKey.length);
    //console.log('WALLET REPO: privKey created, length:', privKey.length);

    // Fix cyrillic (non-latin) passwords
    if (privKey.length > 32) {
      privKey = privKey.slice(-32);
    }
    getGlobalWorkletLogging().logging1string1number('WALLET REPO: privKey normalized to length:', privKey.length);
    //console.log('WALLET REPO: privKey normalized to length:', privKey.length);

    // Use Web Crypto API for secure random nonce (117x faster than nacl.randomBytes)
    const nonce = new Uint8Array(24);
    crypto.getRandomValues(nonce);

    // Base64 encode nonce: Use JS for small data (faster), native as fallback
    let rawNonce: string;
    if (nacl.util && nacl.util.encodeBase64) {
      rawNonce = nacl.util.encodeBase64(nonce);
    } else {
      // Fallback to native libsodium (better than deprecated btoa)
      const nonceBuffer = nonce.buffer as ArrayBuffer;
      rawNonce = concealCrypto.bin2base64(nonceBuffer);
    }

    const rawWallet = wallet.exportToRaw();
    const uint8EncryptedContent = new (<any>TextEncoder)('utf8').encode(JSON.stringify(rawWallet));

    // Encrypt wallet using native secretbox
    let encrypted: Uint8Array;
    try {
      // Optimized ArrayBuffer preparation - avoid copy if already aligned
      const messageBuffer =
        uint8EncryptedContent.byteOffset === 0 && uint8EncryptedContent.byteLength === uint8EncryptedContent.buffer.byteLength
          ? (uint8EncryptedContent.buffer as ArrayBuffer)
          : (() => {
              const buf = new ArrayBuffer(uint8EncryptedContent.length);
              new Uint8Array(buf).set(uint8EncryptedContent);
              return buf;
            })();

      const nonceBuffer =
        nonce.byteOffset === 0 && nonce.byteLength === nonce.buffer.byteLength
          ? (nonce.buffer as ArrayBuffer)
          : (() => {
              const buf = new ArrayBuffer(nonce.length);
              new Uint8Array(buf).set(nonce);
              return buf;
            })();

      const keyBuffer =
        privKey.byteOffset === 0 && privKey.byteLength === privKey.buffer.byteLength
          ? (privKey.buffer as ArrayBuffer)
          : (() => {
              const buf = new ArrayBuffer(privKey.length);
              new Uint8Array(buf).set(privKey);
              return buf;
            })();

      const result = concealCrypto.secretbox(messageBuffer, nonceBuffer, keyBuffer);
      encrypted = new Uint8Array(result);
    } catch (error) {
      console.warn('Native secretbox failed, using nacl fallback:', error);
      encrypted = nacl.secretbox(uint8EncryptedContent, nonce, privKey);
    }

    const tabEncrypted = [];
    for (let i = 0; i < encrypted.length; ++i) {
      tabEncrypted.push(encrypted[i]);
    }

    const fullEncryptedWallet: RawFullyEncryptedWallet = {
      data: tabEncrypted,
      nonce: rawNonce,
    };

    return fullEncryptedWallet;
  }

  // Note: deleteLocalCopy is handled by WalletStorageManager.clearWallet()

  // Helper methods for wallet information access (for settings tab)
  static getWalletInfo(wallet: Wallet): {
    publicAddress: string;
    spendKey: string;
    viewKey: string;
    coinWalletUri: string;
    coinWalletUriM: string;
  } {
    if (wallet.keys.priv.spend === '') throw 'missing_spend';

    return {
      publicAddress: wallet.getPublicAddress(),
      spendKey: wallet.keys.priv.spend,
      viewKey: wallet.keys.priv.view,
      coinWalletUri: CoinUri.encodeWalletKeys(
        wallet.getPublicAddress(),
        wallet.keys.priv.spend,
        wallet.keys.priv.view,
        wallet.creationHeight
      ),
      coinWalletUriM: CoinUri.encodeWalletKeys(wallet.getPublicAddress(), wallet.keys.priv.spend, wallet.keys.priv.view),
    };
  }
}
