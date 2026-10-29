# Transaction message encryption (IETF ChaCha)

Transaction message extras (including 2FA smart messages) are encrypted with
`concealCrypto.cypher.chacha8` / `cypher.chacha12(key, nonce, data)` from
`react-native-conceal-crypto` (IETF layout: 12-byte nonce, 32-bit counter).

Upstream guide: `react-native-conceal-crypto/doc/chacha-ietf-migration.md`.

## Nonce

`messageIndexToIetfNonce(index)` in `model/MessageNonce.ts` builds `0^4 ‖ BE64(index)`, where
`index` is the message-extra ordinal in the transaction (0 for the first). With this layout
the ciphertext is byte-identical to the legacy `concealCrypto.chacha8/12(input, key, iv8)`
calls, so old and new app versions interoperate and no data migration is needed.

Do not use `BE64(index) ‖ 0^4`: it matches only for index 0 and silently breaks index ≥ 1.
Negative or non-integer indexes throw `RangeError`.

## Call sites

- Encrypt: `model/Cn.ts` (transaction construction, message extra).
- Decrypt: `TransactionsExplorer.decryptMessage` (tries ChaCha12, then ChaCha8).

## JS fallback

`JSChaCha8` (`model/ChaCha8.ts`) is not IETF: it uses the djb layout. It keeps receiving the
8-byte IV padded with 4 trailing zero bytes. Never pass it the IETF nonce. ChaCha12 has no JS
fallback.

## Verification

- Unit: `tests/messageIndexToIetfNonce.unit.test.ts` (nonce layout and guards).
- On device: rescan a wallet and confirm existing 2FA messages decrypt; send create/delete
  smart messages and read them back; if available, decrypt a transaction with a second
  message extra (index 1).
