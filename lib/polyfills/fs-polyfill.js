/**
*     Copyright (c) 2025, Acktarius 
*/
// File system polyfill for React Native
module.exports = {
  readFileSync: () => new Uint8Array(0),
  writeFileSync: () => {},
  existsSync: () => false,
  mkdirSync: () => {},
  statSync: () => ({ isDirectory: () => false })
};
