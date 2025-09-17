// nacl-polyfill.js
// Polyfill for nacl library in React Native environment

console.log('NACL POLYFILL: Starting nacl polyfill initialization...');

// Ensure global.nacl exists for React Native
if (typeof global !== 'undefined' && !global.nacl) {
  console.log('NACL POLYFILL: Creating empty global.nacl object...');
  global.nacl = {};  // Clean object - let nacl-fast.js populate it
} else {
  console.log('NACL POLYFILL: global.nacl already exists:', !!global.nacl);
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
