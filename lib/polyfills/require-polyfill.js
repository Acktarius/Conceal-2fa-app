/**
*     Copyright (c) 2025, Acktarius 
*/
// Require polyfill for React Native
const originalRequire = global.require;

global.require = function(module) {
  if (originalRequire) {
    try {
      return originalRequire(module);
    } catch (e) {
      // Fall through to error
    }
  }
  
  // Handle specific modules that we have polyfills for
  if (module === 'crypto') {
    return global.crypto || { getRandomValues: () => {} };
  }
  
  throw new Error(`Module ${module} not found`);
};
