// Module polyfill for Emscripten crypto functions - MUST be before core.min.js
if (typeof global.Module === 'undefined') {
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
    HEAPU8: new Uint8Array(heap),
    HEAPU32: new Uint32Array(heap),
    HEAP8: new Int8Array(heap),
    HEAP16: new Int16Array(heap),
    HEAP32: new Int32Array(heap),
    HEAPU16: new Uint16Array(heap),
    HEAPF32: new Float32Array(heap),
    HEAPF64: new Float64Array(heap)
  };
}
