/** Jest setup for integration tests. @see tests/App.integration.test.tsx */

class MockJSBigInt {
  constructor(public value: string) {}
}
(global as any).JSBigInt = MockJSBigInt;
(global as any).self = global;

jest.mock('../config/runtime', () => ({
  getRuntimeConfig: () => ({
    debugMode: false,
    conceal: { coinUnitPlaces: 6, messageTxAmount: '1000' },
  }),
  logConfigInfo: jest.fn(),
}));

jest.mock('../services/interfaces/IWorkletLogging', () => ({
  getGlobalWorkletLogging: jest.fn(),
}));

jest.mock('react-native-css-interop', () => ({}));
jest.mock('nativewind', () => ({}));

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-font', () => ({
  useFonts: () => [true],
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('../services/WorkletLoggingService', () => ({
  initializeGlobalWorkletLogging: jest.fn(),
}));

jest.mock('../services/WalletService', () => ({
  WalletService: {
    registerInContainer: jest.fn(),
    clearStoredWalletForTesting: jest.fn(),
  },
}));

jest.mock('../services/StorageService', () => ({
  StorageService: {
    registerInContainer: jest.fn(),
  },
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../contexts/QRInputContext', () => ({
  QRInputProvider: ({ children }: { children: React.ReactNode }) => children,
  useQRInput: () => ({ showQRScannerModal: jest.fn() }),
}));

jest.mock('../contexts/WalletContext', () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({
    theme: {
      isDark: false,
      colors: { background: '#000000' },
    },
  }),
}));

jest.mock('../contexts/PasswordPromptContext', () => ({
  PasswordPromptProvider: ({ children }: { children: React.ReactNode }) => children,
  usePasswordPrompt: () => ({
    showPasswordPrompt: false,
    passwordPromptMessage: '',
    passwordPromptTitle: '',
    showPasswordPromptAlert: jest.fn(),
    showPasswordCreationAlert: jest.fn(),
    handlePasswordPrompt: jest.fn(),
    showPasswordCreation: false,
    passwordCreationMessage: '',
    passwordCreationTitle: '',
    handlePasswordCreation: jest.fn(),
  }),
}));

jest.mock('../contexts/SeedInputContext', () => ({
  SeedInputProvider: ({ children }: { children: React.ReactNode }) => children,
  useSeedInput: () => ({ showSeedInputModal: jest.fn() }),
}));

jest.mock('../components/TabNavigator', () => {
  const mockReact = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => mockReact.createElement(Text, null, 'TabNavigator'),
  };
});

jest.mock('../components/PasswordInputAlert', () => ({
  PasswordInputAlert: () => null,
}));

jest.mock('../components/PasswordCreationAlert', () => ({
  PasswordCreationAlert: () => null,
}));

jest.mock('../global.css', () => ({}));
jest.mock('../lib/polyfills/textEncoding/encoding-indexes.js', () => ({}));
jest.mock('../lib/polyfills/textEncoding/encoding.js', () => ({}));
jest.mock('../lib/polyfills/require-polyfill.js', () => ({}));
jest.mock('../lib/polyfills/module-polyfill.js', () => ({}));
jest.mock('../lib/polyfills/process-polyfill.js', () => ({}));
jest.mock('../lib/polyfills/crypto.js', () => ({}));
jest.mock('../lib/polyfills/fs-polyfill.js', () => ({}));
jest.mock('../lib/polyfills/path-polyfill.js', () => ({}));
jest.mock('../lib/polyfills/nacl-polyfill.js', () => ({}));
jest.mock('../lib/biginteger.js', () => ({}));
jest.mock('../lib/polyfills/JSBigIntPolyfill.ts', () => ({}));
jest.mock('../lib/sha3.js', () => ({}));
jest.mock('../lib/crypto.js', () => ({}));
jest.mock('../lib/nacl-fast.js', () => ({}));
jest.mock('../lib/nacl-util.min.js', () => ({}));
jest.mock('../lib/base58.js', () => ({}));
jest.mock('../lib/cn_utils.js', () => ({}));
