/**
*     Copyright (c) 2025, Acktarius 
*/
// nacl-polyfill.js
// Polyfill for nacl library in React Native environment

// Ensure global.nacl exists for React Native
if (typeof global !== 'undefined' && !global.nacl) {
  global.nacl = {};  // Clean object - let nacl-fast.js populate it
} else {
  console.log('NACL POLYFILL: global.nacl already exists:', !!global.nacl);
}

// Add nacl.util encoding/decodingBase64 (nacl-fast.js doesn't provide this)
if (global.nacl) {
  global.nacl.util = {
    encodeBase64: function(bytes) {
      return btoa(String.fromCharCode.apply(null, Array.from(bytes)));
    },
    decodeBase64: function(str) {
      const binaryString = atob(str);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
  };
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = global.nacl;
}

// Export for ES modules
if (typeof exports !== 'undefined') {
  exports.default = global.nacl;
}

console.log('NACL POLYFILL: Polyfill initialization complete');
