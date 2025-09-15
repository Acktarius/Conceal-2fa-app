// nacl-polyfill.js
// Polyfill for nacl library in React Native environment

// Ensure global.nacl exists for React Native
if (typeof global !== 'undefined' && !global.nacl) {
  global.nacl = {};  // Clean object - let nacl-fast.js populate it
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = global.nacl;
}

// Export for ES modules
if (typeof exports !== 'undefined') {
  exports.default = global.nacl;
}
