/// <reference path="./d/config.d.ts" />

import "./global.css";
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Polyfills are handled by metro.config.js aliases and polyfill files

// Import expo-crypto for standard crypto operations
import * as ExpoCrypto from 'expo-crypto';

// import './lib/polyfills/core.min.js';  // Temporarily disabled - might be causing infinite recursion
// Import encoding polyfills FIRST (critical for TextDecoder/TextEncoder)
import './lib/polyfills/textEncoding/encoding-indexes.js';
import './lib/polyfills/textEncoding/encoding.js';
// Import polyfills for React Native compatibility (matching web wallet order)
import './lib/polyfills/require-polyfill.js';
import './lib/polyfills/module-polyfill.js';
import './lib/polyfills/process-polyfill.js';

import './lib/polyfills/crypto.js';
import './lib/polyfills/fs-polyfill.js';
import './lib/polyfills/path-polyfill.js';
import './lib/polyfills/nacl-polyfill.js';

import './lib/biginteger.js';
import './lib/polyfills/JSBigIntPolyfill.ts';  // Polyfill loaded on top of original
import './lib/sha3.js';  // Provides keccak_256 function

// Import Conceal configuration and make it globally available (after JSBigInt is loaded)
import { config } from './config';

// Make config globally available for cn_utils.js BEFORE importing crypto libraries
(global as any).config = config;

// Test both crypto libraries
console.log('ExpoCrypto available:', !!ExpoCrypto);
console.log('Global Module available:', !!(global as any).Module);


// Import cryptographic libraries (matching web wallet order)
import './lib/crypto.js';
import './lib/nacl-fast.js';  // This provides nacl.ll functions (matching web wallet)
import './lib/nacl-util.min.js';
import './lib/base58.js';

// Import Conceal-specific native cryptographic functions (PRIORITY for derivation)
// import './lib/cn_utils_native.js';  // DISABLED: Using crypto.js instead

import './lib/cn_utils.js';

// Debug nacl availability after all imports
console.log('APP: After crypto imports - nacl available:', !!(global as any).nacl);
console.log('APP: nacl.ll available:', !!(global as any).nacl?.ll);
console.log('APP: nacl.ll.ge_add available:', !!(global as any).nacl?.ll?.ge_add);
console.log('APP: nacl.ll.ge_scalarmult_base available:', !!(global as any).nacl?.ll?.ge_scalarmult_base);
console.log('APP: nacl.util available:', !!(global as any).nacl?.util);

// Debug Module availability (from crypto.js)
console.log('APP: self.Module available:', typeof self !== 'undefined' && !!(self as any).Module);
console.log('APP: Module.cwrap available:', typeof self !== 'undefined' && !!(self as any).Module?.ccall);
console.log('APP: Module._malloc available:', typeof self !== 'undefined' && !!(self as any).Module?._malloc);
console.log('APP: Module functions:', typeof self !== 'undefined' ? Object.keys((self as any).Module || {}).length : 'N/A');
console.log('APP: nacl.util.encodeBase64 available:', !!(global as any).nacl?.util?.encodeBase64);



import TabNavigator from './components/TabNavigator';
import { WalletProvider } from './contexts/WalletContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { PasswordPromptProvider, usePasswordPrompt } from './contexts/PasswordPromptContext';
import { SeedInputProvider, useSeedInput } from './contexts/SeedInputContext';
import { QRInputProvider, useQRInput } from './contexts/QRInputContext';
import { PasswordInputAlert } from './components/PasswordInputAlert';
import { PasswordCreationAlert } from './components/PasswordCreationAlert';
import { WalletService } from './services/WalletService'; // MAINTENANCE MODE: One-time wallet clearing for development/testing

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <PasswordPromptProvider>
          <SeedInputProvider>
            <QRInputProvider>
              <WalletProvider>
                <AppContent />
              </WalletProvider>
            </QRInputProvider>
          </SeedInputProvider>
        </PasswordPromptProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const { 
    showPasswordPrompt, 
    passwordPromptMessage, 
    passwordPromptTitle, 
    showPasswordPromptAlert, 
    showPasswordCreationAlert,
    handlePasswordPrompt,
    showPasswordCreation,
    passwordCreationMessage,
    passwordCreationTitle,
    handlePasswordCreation
  } = usePasswordPrompt();
  const { showSeedInputModal } = useSeedInput();
  const { showQRScannerModal } = useQRInput();

  // Set global functions for services to access
  React.useEffect(() => {
    console.log('APP: Setting global passwordPromptContext...');
    (global as any).passwordPromptContext = {
      showPasswordPromptAlert,
      showPasswordCreationAlert
    };
    console.log('APP: Global context set:', !!(global as any).passwordPromptContext);
  }, [showPasswordPromptAlert, showPasswordCreationAlert]);

  React.useEffect(() => {
    console.log('APP: Setting global seedInputContext...');
    (global as any).seedInputContext = {
      showSeedInputModal
    };
    console.log('APP: Global seed context set:', !!(global as any).seedInputContext);
  }, [showSeedInputModal]);

  React.useEffect(() => {
    console.log('APP: Setting global qrInputContext...');
    (global as any).qrInputContext = {
      showQRScannerModal
    };
    console.log('APP: Global QR context set:', !!(global as any).qrInputContext);
  }, [showQRScannerModal]);

  // MAINTENANCE MODE: One-time wallet clearing for development/testing
  /*
  React.useEffect(() => {
    const runMaintenance = async () => {
      try {
        console.log('MAINTENANCE: Starting one-time wallet clearing...');
        await WalletService.clearStoredWalletForTesting();
        console.log('MAINTENANCE: Wallet clearing completed successfully');
      } catch (error) {
        console.error('MAINTENANCE: Error during wallet clearing:', error);
      }
    };
    
    // Run maintenance immediately on app startup
    runMaintenance();
  }, []); // Empty dependency array = run once on mount
  */

  // Debug log when alert state changes
  React.useEffect(() => {
    console.log('APP: Password prompt state changed:', { showPasswordPrompt, passwordPromptTitle, passwordPromptMessage });
  }, [showPasswordPrompt, passwordPromptTitle, passwordPromptMessage]);

  return (
    <NavigationContainer>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.isDark ? "light" : "dark"} />
        <TabNavigator />
        
        <PasswordInputAlert
          visible={showPasswordPrompt}
          title={passwordPromptTitle}
          message={passwordPromptMessage}
          onCancel={() => handlePasswordPrompt(null)}
          onConfirm={handlePasswordPrompt}
        />
        
        <PasswordCreationAlert
          visible={showPasswordCreation}
          title={passwordCreationTitle}
          message={passwordCreationMessage}
          onCancel={() => handlePasswordCreation(null)}
          onConfirm={handlePasswordCreation}
        />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});