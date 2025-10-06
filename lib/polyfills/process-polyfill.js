/**
*     Copyright (c) 2025, Acktarius 
*/
// Process polyfill for React Native
module.exports = {
  stdout: { write: () => {} },
  stderr: { write: () => {} },
  cwd: () => '/',
  env: {},
  argv: ['node', 'app.js'],
  exit: () => {},
  on: () => {}
};

// Also set up global process object for crypto.js
if (typeof global.process === 'undefined') {
  global.process = {
    stdout: { write: () => {} },
    stderr: { write: () => {} },
    cwd: () => '/',
    env: {},
    argv: ['node', 'app.js']
  };
}
