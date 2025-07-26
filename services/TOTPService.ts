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
      let tempCounter = counter;
      for (let i = 7; i >= 0; i--) {
        counterBytes[i] = tempCounter & 0xff;
        tempCounter = Math.floor(tempCounter / 256);
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
    // SHA-1 implementation
    const sha1 = (data: Uint8Array): Uint8Array => {
      // Initialize hash values
      let h0 = 0x67452301;
      let h1 = 0xEFCDAB89;
      let h2 = 0x98BADCFE;
      let h3 = 0x10325476;
      let h4 = 0xC3D2E1F0;

      // Pre-processing: adding padding bits
      const msgLength = data.length;
      const bitLength = msgLength * 8;
      
      // Create padded message
      const paddedLength = Math.ceil((msgLength + 9) / 64) * 64;
      const padded = new Uint8Array(paddedLength);
      padded.set(data);
      padded[msgLength] = 0x80;
      
      // Append length as 64-bit big-endian
      const view = new DataView(padded.buffer);
      view.setUint32(paddedLength - 4, bitLength, false);

      // Process message in 512-bit chunks
      for (let chunk = 0; chunk < paddedLength; chunk += 64) {
        const w = new Uint32Array(80);
        
        // Break chunk into sixteen 32-bit big-endian words
        for (let i = 0; i < 16; i++) {
          w[i] = view.getUint32(chunk + i * 4, false);
        }
        
        // Extend the sixteen 32-bit words into eighty 32-bit words
        for (let i = 16; i < 80; i++) {
          w[i] = this.leftRotate(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
        }
        
        // Initialize hash value for this chunk
        let a = h0, b = h1, c = h2, d = h3, e = h4;
        
        // Main loop
        for (let i = 0; i < 80; i++) {
          let f, k;
          if (i < 20) {
            f = (b & c) | (~b & d);
            k = 0x5A827999;
          } else if (i < 40) {
            f = b ^ c ^ d;
            k = 0x6ED9EBA1;
          } else if (i < 60) {
            f = (b & c) | (b & d) | (c & d);
            k = 0x8F1BBCDC;
          } else {
            f = b ^ c ^ d;
            k = 0xCA62C1D6;
          }
          
          const temp = (this.leftRotate(a, 5) + f + e + k + w[i]) >>> 0;
          e = d;
          d = c;
          c = this.leftRotate(b, 30);
          b = a;
          a = temp;
        }
        
        // Add this chunk's hash to result so far
        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
      }
      
      // Produce the final hash value as a 160-bit number (20 bytes)
      const result = new Uint8Array(20);
      const resultView = new DataView(result.buffer);
      resultView.setUint32(0, h0, false);
      resultView.setUint32(4, h1, false);
      resultView.setUint32(8, h2, false);
      resultView.setUint32(12, h3, false);
      resultView.setUint32(16, h4, false);
      
      return result;
    };

    // HMAC-SHA1 implementation
    const blockSize = 64; // SHA-1 block size
    let keyBytes = key;
    
    // If key is longer than block size, hash it
    if (keyBytes.length > blockSize) {
      keyBytes = sha1(keyBytes);
    }
    
    // If key is shorter than block size, pad with zeros
    if (keyBytes.length < blockSize) {
      const padded = new Uint8Array(blockSize);
      padded.set(keyBytes);
      keyBytes = padded;
    }
    
    // Create inner and outer padded keys
    const innerPadded = new Uint8Array(blockSize);
    const outerPadded = new Uint8Array(blockSize);
    
    for (let i = 0; i < blockSize; i++) {
      innerPadded[i] = keyBytes[i] ^ 0x36;
      outerPadded[i] = keyBytes[i] ^ 0x5c;
    }
    
    // Calculate inner hash
    const innerData = new Uint8Array(blockSize + data.length);
    innerData.set(innerPadded);
    innerData.set(data, blockSize);
    const innerHash = sha1(innerData);
    
    // Calculate outer hash
    const outerData = new Uint8Array(blockSize + innerHash.length);
    outerData.set(outerPadded);
    outerData.set(innerHash, blockSize);
    
    return sha1(outerData);
  }

  private static leftRotate(value: number, amount: number): number {
    return ((value << amount) | (value >>> (32 - amount))) >>> 0;
  }
}