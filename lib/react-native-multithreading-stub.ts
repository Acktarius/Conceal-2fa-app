/**
 * Stub module for react-native-multithreading
 * 
 * This is a placeholder that mimics the real module's API but doesn't actually work.
 * The existing fallback logic in WalletWatchdogRN.ts will detect that thread creation
 * fails and automatically fall back to single-threaded synchronous processing.
 * 
 * Keep this stub in place so the code doesn't break when the real module isn't installed.
 * When react-native-multithreading works properly in the future, just:
 * 1. Add it back to package.json
 * 2. Remove the babel alias that points to this stub
 */

/**
 * Dummy ThreadManager that mimics the real API but always fails
 * This triggers the existing fallback logic in WalletWatchdogRN.ts (lines 48-70)
 */
export class ThreadManager {
  /**
   * Stub createThread function that throws an error
   * This ensures threadSupportAvailable stays false in WalletWatchdogRN.ts
   */
  static createThread(scriptPath: string): any {
    throw new Error('react-native-multithreading stub: Thread creation not supported (using fallback)');
  }
}

// Default export for compatibility
export default {
  ThreadManager
};

