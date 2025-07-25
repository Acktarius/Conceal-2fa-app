import * as Crypto from 'expo-crypto';

export class TOTPService {
  private static readonly PERIOD = 30; // 30 seconds
  private static readonly DIGITS = 6;

  static generateTOTP(secret: string, timestamp?: number): string {
    const time = timestamp || Math.floor(Date.now() / 1000);
    const counter = Math.floor(time / this.PERIOD);
    
    try {
      // This is a simplified TOTP implementation
      // In a real app, you'd use a proper HMAC-SHA1 implementation
      const hash = this.simpleHash(secret + counter.toString());
      const code = this.truncate(hash);
      return code.toString().padStart(this.DIGITS, '0');
    } catch (error) {
      console.error('Error generating TOTP:', error);
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

  private static simpleHash(input: string): number {
    // This is a simplified hash function for demo purposes
    // In production, use proper HMAC-SHA1
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private static truncate(hash: number): number {
    const offset = hash & 0xf;
    const truncatedHash = (hash >> offset) & 0x7fffffff;
    return truncatedHash % Math.pow(10, this.DIGITS);
  }

  static validateSecret(secret: string): boolean {
    // Basic validation for base32 encoded secrets
    const base32Regex = /^[A-Z2-7]+=*$/;
    return base32Regex.test(secret.toUpperCase()) && secret.length >= 16;
  }
}