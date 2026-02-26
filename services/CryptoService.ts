/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 *
 * This file is part of Conceal-2FA-App
 *
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */
export class CryptoService {
  static async hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    // SHA-1 implementation
    const sha1 = (data: Uint8Array): Uint8Array => {
      // Initialize hash values
      let h0 = 0x67452301;
      let h1 = 0xefcdab89;
      let h2 = 0x98badcfe;
      let h3 = 0x10325476;
      let h4 = 0xc3d2e1f0;

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
        let a = h0,
          b = h1,
          c = h2,
          d = h3,
          e = h4;

        // Main loop
        for (let i = 0; i < 80; i++) {
          let f, k;
          if (i < 20) {
            f = (b & c) | (~b & d);
            k = 0x5a827999;
          } else if (i < 40) {
            f = b ^ c ^ d;
            k = 0x6ed9eba1;
          } else if (i < 60) {
            f = (b & c) | (b & d) | (c & d);
            k = 0x8f1bbcdc;
          } else {
            f = b ^ c ^ d;
            k = 0xca62c1d6;
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

  /** HMAC-SHA-256 (pure JS, RFC 4868 compliant) */
  static async hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const sha256 = (msg: Uint8Array): Uint8Array => {
      const K = new Uint32Array([
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
      ]);
      let [h0, h1, h2, h3, h4, h5, h6, h7] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
      ];
      const len = msg.length;
      const bitLen = len * 8;
      const padLen = Math.ceil((len + 9) / 64) * 64;
      const padded = new Uint8Array(padLen);
      padded.set(msg);
      padded[len] = 0x80;
      const dv = new DataView(padded.buffer);
      dv.setUint32(padLen - 4, bitLen, false);

      const rotr32 = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;
      for (let i = 0; i < padLen; i += 64) {
        const w = new Uint32Array(64);
        for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
        for (let j = 16; j < 64; j++) {
          const s0 = rotr32(w[j-15],7) ^ rotr32(w[j-15],18) ^ (w[j-15] >>> 3);
          const s1 = rotr32(w[j-2],17) ^ rotr32(w[j-2],19) ^ (w[j-2] >>> 10);
          w[j] = (w[j-16] + s0 + w[j-7] + s1) >>> 0;
        }
        let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
        for (let j = 0; j < 64; j++) {
          const S1 = rotr32(e,6) ^ rotr32(e,11) ^ rotr32(e,25);
          const ch = (e & f) ^ (~e & g);
          const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
          const S0 = rotr32(a,2) ^ rotr32(a,13) ^ rotr32(a,22);
          const maj = (a & b) ^ (a & c) ^ (b & c);
          const temp2 = (S0 + maj) >>> 0;
          h=g; g=f; f=e; e=(d+temp1)>>>0;
          d=c; c=b; b=a; a=(temp1+temp2)>>>0;
        }
        h0=(h0+a)>>>0; h1=(h1+b)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0;
        h4=(h4+e)>>>0; h5=(h5+f)>>>0; h6=(h6+g)>>>0; h7=(h7+h)>>>0;
      }
      const out = new Uint8Array(32);
      const odv = new DataView(out.buffer);
      [h0,h1,h2,h3,h4,h5,h6,h7].forEach((v,i) => odv.setUint32(i*4, v, false));
      return out;
    };

    const blockSize = 64;
    let keyBytes = key.length > blockSize ? sha256(key) : key;
    if (keyBytes.length < blockSize) {
      const tmp = new Uint8Array(blockSize);
      tmp.set(keyBytes);
      keyBytes = tmp;
    }
    const inner = new Uint8Array(blockSize);
    const outer = new Uint8Array(blockSize);
    for (let i = 0; i < blockSize; i++) { inner[i] = keyBytes[i] ^ 0x36; outer[i] = keyBytes[i] ^ 0x5c; }
    const innerData = new Uint8Array(blockSize + data.length);
    innerData.set(inner); innerData.set(data, blockSize);
    const innerHash = sha256(innerData);
    const outerData = new Uint8Array(blockSize + innerHash.length);
    outerData.set(outer); outerData.set(innerHash, blockSize);
    return sha256(outerData);
  }

  /** HMAC-SHA-512 (pure JS, RFC 4868 compliant) */
  static async hmacSha512(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    // 64-bit addition via two 32-bit words
    const add64 = (ah: number, al: number, bh: number, bl: number): [number, number] => {
      const lo = (al + bl) >>> 0;
      const hi = (ah + bh + (lo < al ? 1 : 0)) >>> 0;
      return [hi, lo];
    };
    const rotr64 = (hi: number, lo: number, n: number): [number, number] =>
      n < 32
        ? [(hi >>> n) | (lo << (32 - n)), (lo >>> n) | (hi << (32 - n))]
        : [(lo >>> (n - 32)) | (hi << (64 - n)), (hi >>> (n - 32)) | (lo << (64 - n))];
    const shr64 = (hi: number, lo: number, n: number): [number, number] =>
      n < 32 ? [hi >>> n, (lo >>> n) | (hi << (32 - n))] : [0, hi >>> (n - 32)];

    const KH = new Uint32Array([
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
    ]);
    const KL = new Uint32Array([
      0xd728ae22,0x23ef65cd,0xec4d3b2f,0x8189dbbc,0xf348b538,0xb605d019,0xaf194f9b,0xda6d8118,
      0xa3030242,0x45706fbe,0x4ee4b28c,0xd5ffb4e2,0xf27b896f,0x3b1696b1,0x25c71235,0xcf692694,
      0x9ef14ad2,0x384f25e3,0x8b8cd5b5,0x77ac9c65,0x592b0275,0x6ea6e483,0xbd41fbd4,0x831153b5,
      0xee66dfab,0x2db43210,0x98fb213f,0xbeef0ee4,0x3da88fc2,0x930aa725,0xe003826f,0x0a0e6e70,
      0x46d22ffc,0x5c26c926,0x5ac42aed,0x9d95b3df,0x8baf63de,0x3c77b2a8,0x47edaee6,0x1482353b,
      0x4cf10364,0xbc423001,0xd0f89791,0x0654be30,0xd6ef5218,0x5565a910,0x5771202a,0x32bbd1b8,
      0xb8d2d0c8,0x5141ab53,0xdf8eeb99,0xe19b48a8,0xc5c95a63,0xe3418acb,0x7763e373,0xd6b2b8a3,
      0x5defb2fc,0x43172f60,0xa1f0ab72,0x1a6439ec,0x23631e28,0xde82bde9,0xb2c67915,0xe372532b,
    ]);

    const sha512 = (msg: Uint8Array): Uint8Array => {
      let [h0h,h0l,h1h,h1l,h2h,h2l,h3h,h3l] = [
        0x6a09e667,0xf3bcc908, 0xbb67ae85,0x84caa73b, 0x3c6ef372,0xfe94f82b, 0xa54ff53a,0x5f1d36f1,
      ];
      let [h4h,h4l,h5h,h5l,h6h,h6l,h7h,h7l] = [
        0x510e527f,0xade682d1, 0x9b05688c,0x2b3e6c1f, 0x1f83d9ab,0xfb41bd6b, 0x5be0cd19,0x137e2179,
      ];

      const len = msg.length;
      const bitLenHi = Math.floor(len / 0x20000000) | 0;
      const bitLenLo = (len * 8) >>> 0;
      const padLen = Math.ceil((len + 17) / 128) * 128;
      const padded = new Uint8Array(padLen);
      padded.set(msg);
      padded[len] = 0x80;
      const dv = new DataView(padded.buffer);
      dv.setUint32(padLen - 8, bitLenHi, false);
      dv.setUint32(padLen - 4, bitLenLo, false);

      const wh = new Uint32Array(80);
      const wl = new Uint32Array(80);

      for (let i = 0; i < padLen; i += 128) {
        for (let j = 0; j < 16; j++) {
          wh[j] = dv.getUint32(i + j*8, false);
          wl[j] = dv.getUint32(i + j*8 + 4, false);
        }
        for (let j = 16; j < 80; j++) {
          let [s0h,s0l] = rotr64(wh[j-15],wl[j-15],1);
          let [r0h,r0l] = rotr64(wh[j-15],wl[j-15],8);
          let [sh0h,sh0l] = shr64(wh[j-15],wl[j-15],7);
          s0h ^= r0h ^ sh0h; s0l ^= r0l ^ sh0l;
          let [s1h,s1l] = rotr64(wh[j-2],wl[j-2],19);
          let [r1h,r1l] = rotr64(wh[j-2],wl[j-2],61);
          let [sh1h,sh1l] = shr64(wh[j-2],wl[j-2],6);
          s1h ^= r1h ^ sh1h; s1l ^= r1l ^ sh1l;
          [wh[j],wl[j]] = add64(...add64(...add64(wh[j-16],wl[j-16],s0h,s0l),wh[j-7],wl[j-7]),s1h,s1l);
        }
        let [ah,al,bh,bl,ch,cl,dh,dl] = [h0h,h0l,h1h,h1l,h2h,h2l,h3h,h3l];
        let [eh,el,fh,fl,gh,gl,hh,hl] = [h4h,h4l,h5h,h5l,h6h,h6l,h7h,h7l];
        for (let j = 0; j < 80; j++) {
          const [s1h,s1l_] = [
            (rotr64(eh,el,14)[0] ^ rotr64(eh,el,18)[0] ^ rotr64(eh,el,41)[0]),
            (rotr64(eh,el,14)[1] ^ rotr64(eh,el,18)[1] ^ rotr64(eh,el,41)[1]),
          ];
          const chh = (eh & fh) ^ (~eh & gh);
          const chl = (el & fl) ^ (~el & gl);
          const [t1h,t1l] = add64(...add64(...add64(...add64(hh,hl,s1h,s1l_),chh>>>0,chl>>>0),KH[j],KL[j]),wh[j],wl[j]);
          const [s0h,s0l] = [
            (rotr64(ah,al,28)[0] ^ rotr64(ah,al,34)[0] ^ rotr64(ah,al,39)[0]),
            (rotr64(ah,al,28)[1] ^ rotr64(ah,al,34)[1] ^ rotr64(ah,al,39)[1]),
          ];
          const majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
          const majl = (al & bl) ^ (al & cl) ^ (bl & cl);
          const [t2h,t2l] = add64(s0h,s0l,majh>>>0,majl>>>0);
          hh=gh; hl=gl; gh=fh; gl=fl; fh=eh; fl=el;
          [eh,el] = add64(dh,dl,t1h,t1l);
          dh=ch; dl=cl; ch=bh; cl=bl; bh=ah; bl=al;
          [ah,al] = add64(t1h,t1l,t2h,t2l);
        }
        [h0h,h0l]=add64(h0h,h0l,ah,al); [h1h,h1l]=add64(h1h,h1l,bh,bl);
        [h2h,h2l]=add64(h2h,h2l,ch,cl); [h3h,h3l]=add64(h3h,h3l,dh,dl);
        [h4h,h4l]=add64(h4h,h4l,eh,el); [h5h,h5l]=add64(h5h,h5l,fh,fl);
        [h6h,h6l]=add64(h6h,h6l,gh,gl); [h7h,h7l]=add64(h7h,h7l,hh,hl);
      }
      const out = new Uint8Array(64);
      const odv = new DataView(out.buffer);
      const words = [h0h,h0l,h1h,h1l,h2h,h2l,h3h,h3l,h4h,h4l,h5h,h5l,h6h,h6l,h7h,h7l];
      words.forEach((v,i) => odv.setUint32(i*4, v, false));
      return out;
    };

    const blockSize = 128;
    let keyBytes = key.length > blockSize ? sha512(key) : key;
    if (keyBytes.length < blockSize) {
      const tmp = new Uint8Array(blockSize);
      tmp.set(keyBytes);
      keyBytes = tmp;
    }
    const inner = new Uint8Array(blockSize);
    const outer = new Uint8Array(blockSize);
    for (let i = 0; i < blockSize; i++) { inner[i] = keyBytes[i] ^ 0x36; outer[i] = keyBytes[i] ^ 0x5c; }
    const innerData = new Uint8Array(blockSize + data.length);
    innerData.set(inner); innerData.set(data, blockSize);
    const innerHash = sha512(innerData);
    const outerData = new Uint8Array(blockSize + innerHash.length);
    outerData.set(outer); outerData.set(innerHash, blockSize);
    return sha512(outerData);
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
    const output = new Uint8Array(Math.floor((base32.length * 5) / 8));
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
