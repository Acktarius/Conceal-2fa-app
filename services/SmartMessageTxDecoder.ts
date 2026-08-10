import { CnUtils } from '../model/Cn';
import { SmartMessageParser } from '../model/SmartMessage';
import type { Transaction } from '../model/Transaction';
import { TransactionsExplorer, TX_EXTRA_MESSAGE_TAG } from '../model/TransactionsExplorer';
import type { RawWallet, Wallet } from '../model/Wallet';

type EncryptedPayload = {
  rawMessage: string;
  messageExtraIndex: number;
};

function isHexPayload(value: string): boolean {
  return value.length >= 8 && value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value);
}

function extractEncryptedPayloads(extraHex: string): EncryptedPayload[] {
  const payloads: EncryptedPayload[] = [];
  try {
    const uint8Array = CnUtils.hextobin(extraHex);
    const hexExtra: number[] = [];
    for (let i = 0; i < uint8Array.byteLength; i++) {
      hexExtra[i] = uint8Array[i];
    }

    let messageExtraIndex = -1;
    for (const extra of TransactionsExplorer.parseExtra(hexExtra)) {
      if (extra.type !== TX_EXTRA_MESSAGE_TAG) {
        continue;
      }
      messageExtraIndex++;
      let rawChars = '';
      for (let i = 0; i < extra.data.length; ++i) {
        rawChars += String.fromCharCode(extra.data[i]);
      }
      payloads.push({
        rawMessage: CnUtils.bintohex(rawChars),
        messageExtraIndex,
      });
    }
  } catch {
    // unreadable extra — skip
  }
  return payloads;
}

function tryDecrypt2FAMessage(txPubKey: string, spendKey: string, rawMessageHex: string, messageExtraIndex: number): string | null {
  if (!txPubKey || !spendKey || !rawMessageHex) {
    return null;
  }

  try {
    const decrypted = TransactionsExplorer.decryptMessage(messageExtraIndex, txPubKey, spendKey, rawMessageHex);
    if (typeof decrypted === 'string' && decrypted !== 'null' && SmartMessageParser.is2FASmartMessage(decrypted)) {
      return decrypted.trim();
    }
  } catch {
    // decryption failed for this payload
  }

  return null;
}

function indexRawTransactions(rawWallet?: RawWallet): Map<string, Record<string, unknown>> {
  const byHash = new Map<string, Record<string, unknown>>();
  if (!rawWallet?.transactions) {
    return byHash;
  }

  for (const raw of rawWallet.transactions) {
    if (typeof raw !== 'object' || raw === null) {
      continue;
    }
    const record = raw as Record<string, unknown>;
    const hash = typeof record.hash === 'string' ? record.hash : '';
    if (hash) {
      byHash.set(hash, record);
    }
  }
  return byHash;
}

/** Resolve every `{2FA,c|d,...}` body for a wallet tx (plaintext + ChaCha8/12 decrypt). */
export function resolve2FAMessagesFromTransaction(tx: Transaction, wallet: Wallet, rawTx?: Record<string, unknown>): string[] {
  const found = new Set<string>();
  const spendKey = wallet.keys?.priv?.spend ?? '';

  const addMessage = (message: unknown) => {
    if (typeof message === 'string' && message !== 'null' && SmartMessageParser.is2FASmartMessage(message)) {
      found.add(message.trim());
    }
  };

  addMessage(tx.message);

  const encryptedPayloads: EncryptedPayload[] = [];
  if (tx.extraSharedKey?.trim() && isHexPayload(tx.extraSharedKey.trim())) {
    encryptedPayloads.push({ rawMessage: tx.extraSharedKey.trim(), messageExtraIndex: 0 });
  }

  const extraHex = typeof rawTx?.extra === 'string' ? rawTx.extra : typeof rawTx?.Extra === 'string' ? rawTx.Extra : '';
  if (extraHex) {
    encryptedPayloads.push(...extractEncryptedPayloads(extraHex));
  }

  const encryptedMessage =
    typeof rawTx?.encryptedMessage === 'string' ? rawTx.encryptedMessage : typeof rawTx?.rawMessage === 'string' ? rawTx.rawMessage : '';
  if (encryptedMessage && isHexPayload(encryptedMessage)) {
    encryptedPayloads.push({ rawMessage: encryptedMessage, messageExtraIndex: 0 });
  }

  // Some backups store ciphertext hex in `message` when decrypt failed at export time.
  if (tx.message?.trim() && !SmartMessageParser.isSmartMessage(tx.message.trim()) && isHexPayload(tx.message.trim())) {
    encryptedPayloads.push({ rawMessage: tx.message.trim(), messageExtraIndex: 0 });
  }

  if (spendKey && tx.txPubKey) {
    for (const payload of encryptedPayloads) {
      const decrypted = tryDecrypt2FAMessage(tx.txPubKey, spendKey, payload.rawMessage, payload.messageExtraIndex);
      if (decrypted) {
        found.add(decrypted);
      }
    }
  }

  return [...found];
}

export function indexRawTransactionsByHash(rawWallet?: RawWallet): Map<string, Record<string, unknown>> {
  return indexRawTransactions(rawWallet);
}
