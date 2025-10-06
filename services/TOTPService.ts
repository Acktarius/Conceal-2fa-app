import * as Crypto from 'expo-crypto';
import { CryptoService } from './CryptoService';

export class TOTPService {
  private static readonly PERIOD = 30; // 30 seconds
  private static readonly DIGITS = 6;

  static async generateTOTP(secret: string, timestamp?: number): Promise<string> {
    try {
      // Decode base32 secret
      const secretBytes = CryptoService.base32Decode(secret.replace(/\s/g, '').toUpperCase());
      
      // Calculate time counter
      const time = timestamp || Math.floor(Date.now() / 1000);
      const counter = Math.floor(time / this.PERIOD);
      
      // Convert counter to 8-byte array (big-endian)
      const counterBytes = new Uint8Array(8);
      let tempCounter = counter;
      for (let i = 7; i >= 0; i--) {
        counterBytes[i] = tempCounter & 0xff;
        tempCounter = Math.floor(tempCounter / 256);
      }
      
      // Generate HMAC-SHA1
      const hmac = await CryptoService.hmacSha1(secretBytes, counterBytes);
      
      // Dynamic truncation
      const offset = hmac[hmac.length - 1] & 0x0f;
      const code = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff);
      
      // Generate final code
      const otp = (code % Math.pow(10, this.DIGITS)).toString().padStart(this.DIGITS, '0');
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
      
      // Convert time step to 8-byte array (big-endian)
      const counterBytes = new Uint8Array(8);
      let tempCounter = timeStep;
      for (let i = 7; i >= 0; i--) {
        counterBytes[i] = tempCounter & 0xff;
        tempCounter = Math.floor(tempCounter / 256);
      }
      
      // Generate HMAC-SHA1
      const hmac = await CryptoService.hmacSha1(secretBytes, counterBytes);
      
      // Dynamic truncation
      const offset = hmac[hmac.length - 1] & 0x0f;
      const code = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff);
      
      // Generate final code
      const otp = (code % Math.pow(10, this.DIGITS)).toString().padStart(this.DIGITS, '0');
      return otp;
    } catch (error) {
      console.error('Error generating TOTP for time step:', error);
      return '000000';
    }
  }

  static getTimeRemaining(): number {
    const now = Math.floor(Date.now() / 1000);
    return this.PERIOD - (now % this.PERIOD);
  }

  static getCurrentPeriod(): number {
    return Math.floor(Date.now() / 1000 / this.PERIOD);
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