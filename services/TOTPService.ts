import * as Crypto from 'expo-crypto';
import { CryptoService } from './CryptoService';
import concealCrypto from 'react-native-conceal-crypto';

export class TOTPService {
  private static readonly PERIOD = 30; // 30 seconds
  private static readonly DIGITS = 6;

  static async generateTOTP(secret: string, timestamp?: number): Promise<string> {
    try {
      // Decode base32 secret
      const secretBytes = CryptoService.base32Decode(secret.replace(/\s/g, '').toUpperCase());
      
      // Calculate time counter
      const time = timestamp || Math.floor(Date.now() / 1000);
      const counter = Math.floor(time / TOTPService.PERIOD);
      
      // ✅ Optimized ArrayBuffer with DataView (faster than manual byte manipulation)
      const counterBuffer = new ArrayBuffer(8);
      const counterView = new DataView(counterBuffer);
      counterView.setBigUint64(0, BigInt(counter), false); // false = big-endian
      
      // Prepare secret as ArrayBuffer for native implementation
      const secretBuffer = new ArrayBuffer(secretBytes.length);
      const secretView = new Uint8Array(secretBuffer);
      secretView.set(secretBytes);
      
      // Generate HMAC-SHA1 using native C++ implementation
      let hmac: Uint8Array;
      try {
        const concealCryptoResult = concealCrypto.hmacSha1(secretBuffer, counterBuffer);
        hmac = new Uint8Array(concealCryptoResult);
      } catch (error) {
        // Fallback to JS implementation if native fails
        console.warn('Native hmacSha1 failed, using fallback:', error);
        const counterBytes = new Uint8Array(counterBuffer);
        hmac = await CryptoService.hmacSha1(secretBytes, counterBytes);
      }
     
      // Dynamic truncation
      const offset = hmac[hmac.length - 1] & 0x0f;
      const code = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff);
      
      // Generate final code
      const otp = (code % 10 ** TOTPService.DIGITS).toString().padStart(TOTPService.DIGITS, '0');
      return otp;
    } catch (error) {
      console.error('Error generating TOTP:', error);
      return '000000';
    }
  }

  static async generateTOTPForTimeStep(secret: string, timeStep: number): Promise<string> {
    try {
      // Decode base32 secret
      const secretBytes = CryptoService.base32Decode(secret.replace(/\s/g, '').toUpperCase());
      
      // ✅ Optimized ArrayBuffer with DataView (faster than manual byte manipulation)
      const counterBuffer = new ArrayBuffer(8);
      const counterView = new DataView(counterBuffer);
      counterView.setBigUint64(0, BigInt(timeStep), false); // false = big-endian
      
      // Prepare secret as ArrayBuffer for native implementation
      const secretBuffer = new ArrayBuffer(secretBytes.length);
      const secretView = new Uint8Array(secretBuffer);
      secretView.set(secretBytes);
      
      // Generate HMAC-SHA1 using native C++ implementation
      let hmac: Uint8Array;
      try {
        const concealCryptoResult = concealCrypto.hmacSha1(secretBuffer, counterBuffer);
        hmac = new Uint8Array(concealCryptoResult);
      } catch (error) {
        // Fallback to JS implementation if native fails
        console.warn('Native hmacSha1 failed, using fallback:', error);
        const counterBytes = new Uint8Array(counterBuffer);
        hmac = await CryptoService.hmacSha1(secretBytes, counterBytes);
      }
      
      // Dynamic truncation
      const offset = hmac[hmac.length - 1] & 0x0f;
      const code = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff);
      
      // Generate final code
      const otp = (code % 10 ** TOTPService.DIGITS).toString().padStart(TOTPService.DIGITS, '0');
      return otp;
    } catch (error) {
      console.error('Error generating TOTP for time step:', error);
      return '000000';
    }
  }

  static getTimeRemaining(): number {
    const now = Math.floor(Date.now() / 1000);
    return TOTPService.PERIOD - (now % TOTPService.PERIOD);
  }

  static getCurrentPeriod(): number {
    return Math.floor(Date.now() / 1000 / TOTPService.PERIOD);
  }

  static validateSecret(secret: string): boolean {
    try {
      // Remove spaces and convert to uppercase
      const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
      
      // Check if it's valid base32
      const base32Regex = /^[A-Z2-7]+=*$/;
      if (!base32Regex.test(cleanSecret)) {
        return false;
      }
      
      // Try to decode it
      CryptoService.base32Decode(cleanSecret);
      return cleanSecret.length >= 16;
    } catch (error) {
      return false;
    }
  }
}