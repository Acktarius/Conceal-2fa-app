import * as Crypto from 'expo-crypto';

export class TOTPService {
  private static readonly PERIOD = 30; // 30 seconds
  private static readonly DIGITS = 6;

  static async generateTOTP(secret: string, timestamp?: number): Promise<string> {
    try {
      // Decode base32 secret
      const secretBytes = this.base32Decode(secret.replace(/\s/g, '').toUpperCase());
      
      // Calculate time counter
      const time = timestamp || Math.floor(Date.now() / 1000);
      const counter = Math.floor(time / this.PERIOD);
      
      // Convert counter to 8-byte array (big-endian)
      const counterBytes = new Uint8Array(8);
      for (let i = 7; i >= 0; i--) {
        counterBytes[i] = counter & 0xff;
        counter >>> 8;
      }
      
      // Generate HMAC-SHA1
      const hmac = await this.hmacSha1(secretBytes, counterBytes);
      
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
      this.base32Decode(cleanSecret);
      return cleanSecret.length >= 16;
    } catch (error) {
      return false;
    }
  }

  private static base32Decode(base32: string): Uint8Array {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const base32Map: { [key: string]: number } = {};
    
    // Create reverse mapping
    for (let i = 0; i < base32Chars.length; i++) {
      base32Map[base32Chars[i]] = i;
    }
    
    // Remove padding
    base32 = base32.replace(/=+$/, '');
    
    let bits = 0;
    let value = 0;
    const output = new Uint8Array(Math.floor(base32.length * 5 / 8));
    let outputIndex = 0;
    
    for (let i = 0; i < base32.length; i++) {
      const char = base32[i];
      if (!(char in base32Map)) {
        throw new Error(`Invalid base32 character: ${char}`);
      }
      
      value = (value << 5) | base32Map[char];
      bits += 5;
      
      if (bits >= 8) {
        output[outputIndex++] = (value >>> (bits - 8)) & 0xff;
        bits -= 8;
      }
    }
    
    return output.slice(0, outputIndex);
  }

  private static async hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    // Generate HMAC
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return new Uint8Array(signature);
  }
}