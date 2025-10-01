/**
*     Copyright (c) 2025, Acktarius 
*/
// JSBigInt Polyfill for React Native
// This extends the original BigInteger library from biginteger.js with additional convenience methods

import { config } from '../../config';

// Wait for the original BigInteger to be loaded
const originalJSBigInt = (global as any).JSBigInt;

if (!originalJSBigInt) {
  console.warn('JSBigIntPolyfill: Original JSBigInt not found, polyfill may not work correctly');
}

// Extend the original BigInteger prototype with convenience methods
if (originalJSBigInt && originalJSBigInt.prototype) {
  // Add toNumber method
  originalJSBigInt.prototype.toNumber = function() {
    return this.valueOf();
  };

  // Add toNumberFixed method
  originalJSBigInt.prototype.toNumberFixed = function(decimals: number): string {
    return this.toNumber().toFixed(decimals);
  };

  // Add toHuman method - converts atomic units to human-readable format
  originalJSBigInt.prototype.toHuman = function(): number {
    const humanValue = this.toNumber() / Math.pow(10, config.coinUnitPlaces);
    return humanValue;
  };

  console.log('JSBigIntPolyfill: Successfully extended original JSBigInt with convenience methods');
} else {
  console.error('JSBigIntPolyfill: Failed to extend original JSBigInt - prototype not found');
}

// The polyfill extends the original JSBigInt from biginteger.js
// All original functionality is preserved, we just add convenience methods 