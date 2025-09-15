const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable Metro's Node.js module detection
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

// Configure resolver to handle Node.js modules using aliases only
config.resolver.alias = {
  ...config.resolver.alias,
  crypto: require.resolve('./lib/polyfills/crypto.js'),
  fs: require.resolve('./lib/polyfills/fs-polyfill.js'),
  path: require.resolve('./lib/polyfills/path-polyfill.js'),
  process: require.resolve('./lib/polyfills/process-polyfill.js'),
  nacl: require.resolve('./lib/polyfills/nacl-polyfill.js'),
};

module.exports = config;