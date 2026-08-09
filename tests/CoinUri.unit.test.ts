import { describe, expect, it } from 'vitest';
import { CoinUri } from '../model/CoinUri';

const sampleAddress = `ccx7${'A'.repeat(94)}`;

describe('CoinUri', () => {
  it('encodes and decodes transaction URIs', () => {
    const encoded = CoinUri.encodeTx(sampleAddress, 'pid123', '10.5', 'Alice', 'note');
    const decoded = CoinUri.decodeTx(encoded);
    expect(decoded).toMatchObject({
      address: sampleAddress,
      paymentId: 'pid123',
      amount: '10.5',
      recipientName: 'Alice',
      description: 'note',
    });
    expect(CoinUri.isTxValid(encoded)).toBe(true);
  });

  it('encodes and decodes wallet key URIs', () => {
    const encoded = CoinUri.encodeWalletKeys(sampleAddress, 'spend', 'view', 100);
    const decoded = CoinUri.decodeWallet(encoded);
    expect(decoded.address).toBe(sampleAddress);
    expect(decoded.spendKey).toBe('spend');
    expect(decoded.viewKey).toBe('view');
    expect(decoded.height).toBe('100');
    expect(CoinUri.isWalletValid(encoded)).toBe(true);
  });

  it('rejects invalid address length', () => {
    expect(() => CoinUri.encodeTx('ccx7short')).toThrow('invalid_address_length');
  });
});
