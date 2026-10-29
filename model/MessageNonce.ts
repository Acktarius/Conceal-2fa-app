/** 12-byte IETF ChaCha nonce `0^4 ‖ BE64(index)` for tx message extras. @see docs/security/message-chacha-ietf.md */
export function messageIndexToIetfNonce(index: number): ArrayBuffer {
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError(`invalid message index: ${index}`);
  const nonce = new ArrayBuffer(12);
  new DataView(nonce).setBigUint64(4, BigInt(index), false);
  return nonce;
}
