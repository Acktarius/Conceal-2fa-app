# react-native-multithreading Stub

## Why This Stub Exists

The `react-native-multithreading` module is currently not working as expected in this project, but we want to keep all the multi-threading infrastructure in place for when it works in the future.

## Current Setup

1. **Stub module**: `lib/react-native-multithreading-stub.ts` - A dummy module that mimics the API but always fails
2. **Babel alias**: `babel.config.js` redirects `react-native-multithreading` imports to the stub
3. **Removed from package.json**: The real module is not installed
4. **No code changes needed**: `model/WalletWatchdogRN.ts` already has complete fallback logic (lines 48-70)

## How It Works

1. Code imports `react-native-multithreading` → Babel redirects to stub
2. Stub's `ThreadManager.createThread()` throws an error
3. WalletWatchdogRN catches the error → sets `threadSupportAvailable = false`
4. All processing falls back to single-threaded synchronous mode
5. App works perfectly in single-threaded mode (just slower for large syncs)

## When react-native-multithreading Works Again

To re-enable multi-threading:

1. **Remove the babel alias** from `babel.config.js`:
   ```javascript
   // DELETE THIS:
   'react-native-multithreading': './lib/react-native-multithreading-stub.ts',
   ```

2. **Add back to package.json**:
   ```json
   "react-native-multithreading": "^1.1.1"
   ```

3. **Run**:
   ```bash
   npm install
   npx pod-install  # iOS only
   npx expo start --clear
   ```

4. **Test** - You should see:
   ```
   WalletWatchdogRN: react-native-multithreading fully functional - multi-threading enabled
   WalletWatchdogRN: Thread support - ENABLED
   WalletWatchdogRN: Thread management - Max threads: 4 (multi-threaded)
   ```

## Benefits of This Approach

- ✅ No code changes needed in WalletWatchdogRN.ts
- ✅ All multi-threading infrastructure stays intact
- ✅ Easy to re-enable when module works
- ✅ App works reliably in fallback mode
- ✅ No risk of breaking production builds

## Current Performance

**Single-threaded mode** (current):
- Ring signatures: ~4ms each (native C++ via react-native-conceal-crypto)
- Transaction parsing: Synchronous, one at a time
- Blockchain sync: Still fast, just not parallelized

**Multi-threaded mode** (future):
- Will parallelize transaction parsing across CPU cores
- Faster blockchain synchronization for large gaps
- Better responsiveness during heavy sync operations

