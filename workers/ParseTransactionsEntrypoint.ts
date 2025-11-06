declare const requirejs: any;

importScripts('../lib/polyfills/core.min.js');
importScripts('../lib/polyfills/textEncoding/encoding-indexes.js');
importScripts('../lib/polyfills/textEncoding/encoding.js');
importScripts('../lib/polyfills/crypto.js');

importScripts('../lib/require.js');
importScripts('../lib/biginteger.js');
importScripts('../config.js');
importScripts('../lib/base58.js');
importScripts('../lib/crypto.js');
importScripts('../lib/nacl-fast.js');
importScripts('../lib/nacl-util.min.js');
importScripts('../lib/sha3.js');

try {
  importScripts('../lib/cn_utils_native.js');
  (<any>self).Module_native['onRuntimeInitialized'] = () => {
    requirejs(['./ParseTransactions.js'], (App) => {});
  };
} catch (e) {
  console.error('Failed to load cn_utils_native.js, falling back to JS implementation:', e);
  setTimeout(() => {
    //wait 5s due to crypto //TODO find a better fix
    requirejs(['./ParseTransactions.js'], (App) => {});
  }, 5 * 1000);
}
