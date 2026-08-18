/** Live issuer (provider) filter for 2FA tiles. Empty / whitespace query returns all keys. */

export function filterSharedKeysByIssuer<T extends { issuer?: string }>(keys: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return keys;
  }

  return keys.filter((key) => (key.issuer || '').toLowerCase().includes(needle));
}
