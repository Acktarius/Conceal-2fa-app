import { SmartMessageParser } from '../model/SmartMessage';
import type { RawWallet, Wallet } from '../model/Wallet';
import { indexRawTransactionsByHash, resolve2FAMessagesFromTransaction } from './SmartMessageTxDecoder';

/** One smart-message tx to replay in block order (create/delete sequencing). */
export type SmartMessageReplayEntry = {
  message: string;
  hash: string;
  paymentId?: string;
  blockHeight: number;
  timestamp: number;
};

/** @deprecated Use SmartMessageParser.is2FASmartMessage */
export function is2FASmartMessage(message: string): boolean {
  return SmartMessageParser.is2FASmartMessage(message);
}

function normalizePaymentId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pushReplayEntry(
  entries: SmartMessageReplayEntry[],
  seen: Set<string>,
  candidate: Omit<SmartMessageReplayEntry, 'blockHeight' | 'timestamp'> & { blockHeight?: number; timestamp?: number }
): void {
  if (!candidate.hash || !SmartMessageParser.is2FASmartMessage(candidate.message)) {
    return;
  }
  const dedupeKey = `${candidate.hash}:${candidate.message}`;
  if (seen.has(dedupeKey)) {
    return;
  }
  seen.add(dedupeKey);
  entries.push({
    message: candidate.message,
    hash: candidate.hash,
    paymentId: candidate.paymentId,
    blockHeight: candidate.blockHeight ?? 0,
    timestamp: candidate.timestamp ?? 0,
  });
}

function readNextWalletMessageRecords(
  rawWallet: RawWallet
): Array<Omit<SmartMessageReplayEntry, 'blockHeight' | 'timestamp'> & { blockHeight?: number; timestamp?: number }> {
  const records: Array<Omit<SmartMessageReplayEntry, 'blockHeight' | 'timestamp'> & { blockHeight?: number; timestamp?: number }> = [];
  const raw = rawWallet as RawWallet & Record<string, unknown>;

  for (const field of ['sentMessages', 'receivedMessages'] as const) {
    const list = raw[field];
    if (!Array.isArray(list)) {
      continue;
    }

    for (const item of list) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      const record = item as Record<string, unknown>;
      const body = typeof record.body === 'string' ? record.body : '';
      const hash = typeof record.id === 'string' ? record.id : typeof record.hash === 'string' ? record.hash : '';
      const paymentId =
        field === 'sentMessages'
          ? normalizePaymentId(record.paymentIdTo)
          : (normalizePaymentId(record.paymentIdFrom) ?? normalizePaymentId(record.paymentIdTo));
      const blockHeight = typeof record.blockHeight === 'number' ? record.blockHeight : 0;
      const timestamp =
        typeof record.timestamp === 'number'
          ? record.timestamp
          : typeof record.timestamp === 'string'
            ? Date.parse(record.timestamp) / 1000
            : 0;

      records.push({ message: body, hash, paymentId, blockHeight, timestamp });
    }
  }

  return records;
}

/** Collect 2FA smart messages from wallet txs and next-wallet message records. */
export function collectSmartMessageReplayEntries(wallet: Wallet, rawWallet?: RawWallet): SmartMessageReplayEntry[] {
  const entries: SmartMessageReplayEntry[] = [];
  const seen = new Set<string>();
  const rawByHash = indexRawTransactionsByHash(rawWallet);

  for (const tx of wallet.getAll()) {
    const rawTx = rawByHash.get(tx.hash);
    const messages = resolve2FAMessagesFromTransaction(tx, wallet, rawTx);
    for (const message of messages) {
      pushReplayEntry(entries, seen, {
        message,
        hash: tx.hash,
        paymentId: normalizePaymentId(tx.paymentId),
        blockHeight: tx.blockHeight,
        timestamp: tx.timestamp,
      });
    }
  }

  if (rawWallet) {
    for (const record of readNextWalletMessageRecords(rawWallet)) {
      pushReplayEntry(entries, seen, record);
    }
  }

  return entries.sort((a, b) => {
    if (a.blockHeight !== b.blockHeight) {
      return a.blockHeight - b.blockHeight;
    }
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return a.hash.localeCompare(b.hash);
  });
}
