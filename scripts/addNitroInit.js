const fs = require('fs');
const path = require('path');

// Path to your parent app's MainApplication.kt
const MAIN_APP_PATH = path.join(
    __dirname,
    '..',
    'android',
    'app',
    'src',
    'main',
    'java',
    'com',
    'acktarius',
    'conceal2faapp',
    'MainApplication.kt'
  );
  

// Nitro module Kotlin OnLoad path
const NITRO_INIT_PACKAGE = 'com.margelo.nitro.concealcrypto';
const NITRO_INIT_CLASS = 'ConcealCryptoOnLoad';
const NITRO_IMPORT = `import ${NITRO_INIT_PACKAGE}.${NITRO_INIT_CLASS}`;
const NITRO_INIT_CALL = `${NITRO_INIT_CLASS}.initializeNative()`;

// Function to inject the OnLoad call
function insertInit(source) {
  let result = source;

  // Add import if missing
  if (!result.includes(NITRO_IMPORT)) {
    result = result.replace(/(package .+?\n)/, `$1${NITRO_IMPORT}\n`);
  }

  // Insert initializer into onCreate()
  if (!result.includes(NITRO_INIT_CALL)) {
    result = result.replace(
      /(override fun onCreate\(\)\s*\{\s*super\.onCreate\(\);?)/,
      `$1\n        ${NITRO_INIT_CALL}`
    );
  }

  return result;
}

// Read and modify MainApplication.kt
fs.readFile(MAIN_APP_PATH, 'utf8', (err, data) => {
  if (err) {
    console.error('❌ Could not find MainApplication.kt:', err.message);
    return;
  }

  const updated = insertInit(data);

  fs.writeFile(MAIN_APP_PATH, updated, 'utf8', (err) => {
    if (err) {
      console.error('❌ Failed to update MainApplication.kt:', err.message);
    } else {
      console.log('✅ ConcealCryptoOnLoad.initializeNative() added successfully!');
    }
  });
});
