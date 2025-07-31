// JSBigInt Polyfill for React Native
// This provides compatibility with the JSBigInt library using native BigInt

// Create a JSBigInt class that wraps BigInt
class JSBigIntClass {
  private value: bigint;

  constructor(value: string | number | bigint) {
    this.value = BigInt(value);
  }

  compare(other: JSBigIntClass | bigint): number {
    const otherValue = other instanceof JSBigIntClass ? other.value : BigInt(other);
    if (this.value < otherValue) return -1;
    if (this.value > otherValue) return 1;
    return 0;
  }

  subtract(other: JSBigIntClass | bigint): JSBigIntClass {
    const otherValue = other instanceof JSBigIntClass ? other.value : BigInt(other);
    return new JSBigIntClass(this.value - otherValue);
  }

  divide(other: JSBigIntClass | bigint): JSBigIntClass {
    const otherValue = other instanceof JSBigIntClass ? other.value : BigInt(other);
    return new JSBigIntClass(this.value / otherValue);
  }

  pow(exponent: number): JSBigIntClass {
    return new JSBigIntClass(this.value ** BigInt(exponent));
  }

  toString(radix?: number): string {
    return this.value.toString(radix);
  }

  valueOf(): bigint {
    return this.value;
  }
}

// Create JSBigInt constructor function
const JSBigInt = function(value: string | number | bigint): JSBigIntClass {
  return new JSBigIntClass(value);
} as any;

// Add static methods and properties
JSBigInt.ZERO = new JSBigIntClass(0);
JSBigInt.parse = function(value: string, radix: number = 10): JSBigIntClass {
  return new JSBigIntClass(radix === 16 ? `0x${value}` : value);
};

// Make JSBigInt available globally
(global as any).JSBigInt = JSBigInt;

// Also make it available as a global variable
declare global {
  var JSBigInt: any;
} 