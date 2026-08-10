import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/SmartMessageTxDecoder', () => ({
  indexRawTransactionsByHash: () => new Map(),
  resolve2FAMessagesFromTransaction: (tx: { message?: string }) => {
    const msg = tx.message?.trim() ?? '';
    if (!msg.startsWith('{') || !msg.endsWith('}')) {
      return [];
    }
    const parts = msg.slice(1, -1).split(',');
    const module = parts[0]?.trim().toLowerCase();
    const action = parts[1]?.trim().toLowerCase();
    if (module === '2fa' && (action === 'c' || action === 'd' || action === 'u')) {
      return [msg];
    }
    return [];
  },
}));

import { SmartMessageParser } from '../model/SmartMessage';
import { collectSmartMessageReplayEntries } from '../services/SmartMessageReplay';

const createMsg = '{2FA,c,svc,issuer,SECRET}';
const createMsgMixedCase = '{2Fa,c,svc2,issuer2,SECRET2}';
const deleteMsg = '{2FA,d,abc123hash}';

describe('collectSmartMessageReplayEntries', () => {
  it('sorts wallet transactions by block height and dedupes by hash+message', () => {
    const wallet = {
      getAll: () => [
        { message: deleteMsg, hash: 'tx-delete', paymentId: 'pid2', blockHeight: 200, timestamp: 2 },
        { message: createMsg, hash: 'tx-create', paymentId: 'pid1', blockHeight: 100, timestamp: 1 },
        { message: createMsg, hash: 'tx-create', paymentId: 'pid1', blockHeight: 100, timestamp: 1 },
      ],
    };

    const entries = collectSmartMessageReplayEntries(wallet as never);

    expect(entries).toHaveLength(2);
    expect(entries[0].hash).toBe('tx-create');
    expect(entries[1].hash).toBe('tx-delete');
  });

  it('accepts mixed-case 2Fa module and action', () => {
    expect(SmartMessageParser.is2FASmartMessage(createMsgMixedCase)).toBe(true);
    expect(SmartMessageParser.is2FASmartMessage('{2fa,D,hash}')).toBe(true);
    expect(SmartMessageParser.is2FASmartMessage('{vault,c,x}')).toBe(false);
  });

  it('ignores non-2FA smart messages', () => {
    const wallet = {
      getAll: () => [
        { message: '{vault,c,data}', hash: 'vault-tx', blockHeight: 1, timestamp: 1 },
        { message: createMsg, hash: '2fa-tx', blockHeight: 2, timestamp: 2 },
      ],
    };

    const entries = collectSmartMessageReplayEntries(wallet as never);
    expect(entries).toHaveLength(1);
    expect(entries[0].hash).toBe('2fa-tx');
  });

  it('includes next-wallet sent/received message records from raw blob', () => {
    const wallet = { getAll: () => [] };
    const raw = {
      sentMessages: [
        {
          id: 'sent-tx',
          body: createMsg,
          paymentIdTo: 'pay-to',
          blockHeight: 50,
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ],
      receivedMessages: [
        {
          id: 'recv-tx',
          body: deleteMsg,
          paymentIdFrom: 'pay-from',
          blockHeight: 60,
          timestamp: 1700000000,
        },
      ],
    };

    const entries = collectSmartMessageReplayEntries(wallet as never, raw as never);

    expect(entries.map((entry) => entry.hash)).toEqual(['sent-tx', 'recv-tx']);
    expect(entries[0].paymentId).toBe('pay-to');
    expect(entries[1].paymentId).toBe('pay-from');
  });

  it('collects mixed-case 2Fa create messages', () => {
    const wallet = {
      getAll: () => [{ message: createMsgMixedCase, hash: 'mixed-tx', blockHeight: 3, timestamp: 3 }],
    };

    const entries = collectSmartMessageReplayEntries(wallet as never);
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe(createMsgMixedCase);
  });
});
