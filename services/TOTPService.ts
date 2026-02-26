/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */
import concealCrypto from 'react-native-conceal-crypto';
import { CryptoService } from './CryptoService';

export type TOTPAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';
export type TOTPDigits = 6 | 7 | 8;
export type TOTPPeriod = 30 | 60;

const DEFAULT_ALGORITHM: TOTPAlgorithm = 'SHA1';
const DEFAULT_DIGITS: TOTPDigits = 6;
const DEFAULT_PERIOD: TOTPPeriod = 30;

export class TOTPService {
  /**
   * Compute HMAC using the specified algorithm.
   * All three variants attempt the native C++ implementation first,
   * falling back to pure-JS if the native call throws.
   */
  private static async computeHMAC(
    algorithm: TOTPAlgorithm,
    secretBytes: Uint8Array,
    counterBytes: Uint8Array,
  ): Promise<Uint8Array> {
    const toBuffer = (u8: Uint8Array): ArrayBuffer => {
      const buf = new ArrayBuffer(u8.length);
      new Uint8Array(buf).set(u8);
      return buf;
    };

    switch (algorithm) {
      case 'SHA1':
        try {
          return new Uint8Array(
            concealCrypto.hmacSha1(toBuffer(secretBytes), toBuffer(counterBytes)),
          );
        } catch (error) {
          console.warn('Native hmacSha1 failed, using JS fallback:', error);
          return CryptoService.hmacSha1(secretBytes, counterBytes);
        }

      case 'SHA256':
        try {
          return new Uint8Array(
            concealCrypto.hmacSha256(toBuffer(secretBytes), toBuffer(counterBytes)),
          );
        } catch (error) {
          console.warn('Native hmacSha256 failed, using JS fallback:', error);
          return CryptoService.hmacSha256(secretBytes, counterBytes);
        }

      case 'SHA512':
        try {
          return new Uint8Array(
            concealCrypto.hmacSha512(toBuffer(secretBytes), toBuffer(counterBytes)),
          );
        } catch (error) {
          console.warn('Native hmacSha512 failed, using JS fallback:', error);
          return CryptoService.hmacSha512(secretBytes, counterBytes);
        }
    }
  }

  /** Build an 8-byte big-endian counter buffer from a counter value. */
  private static counterBuffer(counter: number): Uint8Array {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigUint64(0, BigInt(counter), false);
    return new Uint8Array(buf);
  }

  /** Dynamic truncation + digit extraction (works for any HMAC length). */
  private static truncate(hmac: Uint8Array, digits: TOTPDigits): string {
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return (code % 10 ** digits).toString().padStart(digits, '0');
  }

  static async generateTOTP(
    secret: string,
    timestamp?: number,
    algorithm: TOTPAlgorithm = DEFAULT_ALGORITHM,
    digits: TOTPDigits = DEFAULT_DIGITS,
    period: TOTPPeriod = DEFAULT_PERIOD,
  ): Promise<string> {
    try {
      const secretBytes = CryptoService.base32Decode(secret.replace(/\s/g, '').toUpperCase());
      const time = timestamp ?? Math.floor(Date.now() / 1000);
      const counter = Math.floor(time / period);
      const hmac = await TOTPService.computeHMAC(algorithm, secretBytes, TOTPService.counterBuffer(counter));
      return TOTPService.truncate(hmac, digits);
    } catch (error) {
      console.error('Error generating TOTP:', error);
      return '0'.padStart(digits, '0');
    }
  }

  static async generateTOTPForTimeStep(
    secret: string,
    timeStep: number,
    algorithm: TOTPAlgorithm = DEFAULT_ALGORITHM,
    digits: TOTPDigits = DEFAULT_DIGITS,
  ): Promise<string> {
    try {
      const secretBytes = CryptoService.base32Decode(secret.replace(/\s/g, '').toUpperCase());
      const hmac = await TOTPService.computeHMAC(algorithm, secretBytes, TOTPService.counterBuffer(timeStep));
      return TOTPService.truncate(hmac, digits);
    } catch (error) {
      console.error('Error generating TOTP for time step:', error);
      return '0'.padStart(digits, '0');
    }
  }

  static getTimeRemaining(period: TOTPPeriod = DEFAULT_PERIOD): number {
    const now = Math.floor(Date.now() / 1000);
    return period - (now % period);
  }

  static getCurrentPeriod(period: TOTPPeriod = DEFAULT_PERIOD): number {
    return Math.floor(Date.now() / 1000 / period);
  }

  static validateSecret(secret: string): boolean {
    try {
      const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
      const base32Regex = /^[A-Z2-7]+=*$/;
      if (!base32Regex.test(cleanSecret)) {
        return false;
      }
      CryptoService.base32Decode(cleanSecret);
      return cleanSecret.length >= 16;
    } catch (error) {
      console.error('Failed to validate TOTP secret:', error);
      return false;
    }
  }
}
