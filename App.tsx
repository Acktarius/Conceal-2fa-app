/// <reference path="./d/config.d.ts" />
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Polyfills are handled by metro.config.js aliases and polyfill files

// Import expo-crypto for standard crypto operations
import * as ExpoCrypto from 'expo-crypto';

// Import polyfills for React Native compatibility (matching web wallet order)
import './lib/polyfills/require-polyfill.js';
import './lib/polyfills/module-polyfill.js';
import './lib/polyfills/process-polyfill.js';
// import './lib/polyfills/core.min.js';  // Temporarily disabled - might be causing infinite recursion
import './lib/polyfills/textEncoding/encoding-indexes.js';
import './lib/polyfills/textEncoding/encoding.js';
import './lib/polyfills/crypto.js';
import './lib/polyfills/fs-polyfill.js';
import './lib/polyfills/path-polyfill.js';
import './lib/polyfills/nacl-polyfill.js';
import './lib/biginteger.js';
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
import './lib/cn_utils.js';
//import './lib/cn_utils_native.js'; WIP modifying cn_utils.js to work with React Native and avoiding use of cn_utils_native.js



import TabNavigator from './components/TabNavigator';
import { WalletProvider } from './contexts/WalletContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { PasswordPromptProvider, usePasswordPrompt } from './contexts/PasswordPromptContext';
import { SeedInputProvider, useSeedInput } from './contexts/SeedInputContext';
import { PasswordInputAlert } from './components/PasswordInputAlert';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <PasswordPromptProvider>
          <SeedInputProvider>
            <WalletProvider>
              <AppContent />
            </WalletProvider>
          </SeedInputProvider>
        </PasswordPromptProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const { showPasswordPrompt, passwordPromptMessage, passwordPromptTitle, showPasswordPromptAlert, handlePasswordPrompt } = usePasswordPrompt();
  const { showSeedInputModal } = useSeedInput();

  // Set global functions for services to access
  React.useEffect(() => {
    console.log('APP: Setting global passwordPromptContext...');
    (global as any).passwordPromptContext = {
      showPasswordPromptAlert
    };
    console.log('APP: Global context set:', !!(global as any).passwordPromptContext);
  }, [showPasswordPromptAlert]);

  React.useEffect(() => {
    console.log('APP: Setting global seedInputContext...');
    (global as any).seedInputContext = {
      showSeedInputModal
    };
    console.log('APP: Global seed context set:', !!(global as any).seedInputContext);
  }, [showSeedInputModal]);

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
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});