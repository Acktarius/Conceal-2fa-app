import { describe, expect, it } from 'vitest';
import { filterSharedKeysByIssuer } from '../utils/filterSharedKeys';

const keys = [
  { name: 'alice@gmail', issuer: 'Google' },
  { name: 'work', issuer: 'GitHub' },
  { name: 'bank', issuer: 'Coinbase' },
  { name: 'empty', issuer: '' },
];

describe('filterSharedKeysByIssuer', () => {
  it('returns all keys when the query is empty', () => {
    expect(filterSharedKeysByIssuer(keys, '')).toEqual(keys);
  });

  it('returns all keys when the query is whitespace only', () => {
    expect(filterSharedKeysByIssuer(keys, '   ')).toEqual(keys);
  });

  it('matches issuer substring case-insensitively', () => {
    expect(filterSharedKeysByIssuer(keys, 'git')).toEqual([{ name: 'work', issuer: 'GitHub' }]);
    expect(filterSharedKeysByIssuer(keys, 'GOOGLE')).toEqual([{ name: 'alice@gmail', issuer: 'Google' }]);
  });

  it('trims the query for matching but keeps unmatched keys out', () => {
    expect(filterSharedKeysByIssuer(keys, '  coin  ')).toEqual([{ name: 'bank', issuer: 'Coinbase' }]);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterSharedKeysByIssuer(keys, 'microsoft')).toEqual([]);
  });

  it('does not match on account name', () => {
    expect(filterSharedKeysByIssuer(keys, 'alice')).toEqual([]);
  });
});
