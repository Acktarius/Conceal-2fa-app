const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure resolver aliases for polyfills (manual imports handled in App.tsx)
config.resolver.alias = {
  ...config.resolver.alias,
  crypto: require.resolve('./lib/polyfills/crypto.js'),
  fs: require.resolve('./lib/polyfills/fs-polyfill.js'),
  path: require.resolve('./lib/polyfills/path-polyfill.js'),
  process: require.resolve('./lib/polyfills/process-polyfill.js'),
  nacl: require.resolve('./lib/polyfills/nacl-polyfill.js'),
};

module.exports = config;