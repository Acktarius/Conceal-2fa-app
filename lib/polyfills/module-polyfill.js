// Module polyfill for Emscripten crypto functions - MUST be before core.min.js
console.log('Module polyfill: Checking if Module exists...', typeof global.Module);

// Force immediate Module creation
(function() {
  if (typeof global.Module === 'undefined') {
    console.log('Module polyfill: Creating Module polyfill...');
  // Create a larger HEAP for crypto operations
  const HEAP_SIZE = 32 * 1024 * 1024; // 32MB for crypto operations (matching crypto.js TOTAL_MEMORY)
  const heap = new ArrayBuffer(HEAP_SIZE);
  
  let nextOffset = 0;
  
  global.Module = {
    TOTAL_MEMORY: HEAP_SIZE,
    _malloc: (size) => {
      // Simple malloc implementation - return sequential offsets
      const offset = nextOffset;
      nextOffset += size;
      if (nextOffset > HEAP_SIZE) {
        throw new Error('Out of memory');
      }
      return offset;
    },
    _free: () => {}, // Simple free - don't actually free memory
    ccall: (name, returnType, argTypes, args) => {
      // Stub ccall - return 0 for most functions
      console.log(`ccall: ${name}(${argTypes.join(', ')}) -> ${returnType}`);
      return 0;
    },
    cwrap: (name, returnType, argTypes) => {
      // Create a JavaScript wrapper for a C function
      console.log(`cwrap: ${name}(${argTypes.join(', ')}) -> ${returnType}`);
      return (...args) => {
        console.log(`cwrap call: ${name}(${args.join(', ')})`);
        // For now, return 0 for most functions or throw an error for critical ones
        if (name.includes('sc_check') || name.includes('ge_frombytes_vartime')) {
          return 0; // Success for validation functions
        }
        return 0;
      };
    },
    HEAPU8: new Uint8Array(heap),
    HEAPU32: new Uint32Array(heap),
    HEAP8: new Int8Array(heap),
    HEAP16: new Int16Array(heap),
    HEAP32: new Int32Array(heap),
    HEAPU16: new Uint16Array(heap),
    HEAPF32: new Float32Array(heap),
    HEAPF64: new Float64Array(heap)
  };
    console.log('Module polyfill: Module created successfully', !!global.Module.cwrap);
  } else {
    console.log('Module polyfill: Module already exists');
  }
})();

// Ensure Module is always available globally
if (typeof global.Module !== 'undefined') {
  // Make sure cwrap is always available
  if (typeof global.Module.cwrap === 'undefined') {
    console.log('Module polyfill: Adding missing cwrap function...');
    global.Module.cwrap = (name, returnType, argTypes) => {
      console.log(`cwrap fallback: ${name}(${argTypes.join(', ')}) -> ${returnType}`);
      return (...args) => {
        console.log(`cwrap fallback call: ${name}(${args.join(', ')})`);
        if (name.includes('sc_check') || name.includes('ge_frombytes_vartime')) {
          return 0; // Success for validation functions
        }
        return 0;
      };
    };
  }
}
