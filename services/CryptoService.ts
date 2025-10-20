export class CryptoService {
  static async hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
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
          w[i] = CryptoService.leftRotate(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
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
          
          const temp = (CryptoService.leftRotate(a, 5) + f + e + k + w[i]) >>> 0;
          e = d;
          d = c;
          c = CryptoService.leftRotate(b, 30);
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

  static leftRotate(value: number, amount: number): number {
    return ((value << amount) | (value >>> (32 - amount))) >>> 0;
  }

  static base32Decode(base32: string): Uint8Array {
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
}