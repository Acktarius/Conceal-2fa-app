import type { ConfigContext, ExpoConfig } from 'expo/config';
import 'dotenv/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Conceal Authenticator',
  version: process.env.APP_VERSION || '1.0.0',
  slug: 'conceal-authenticator',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],

  ios: {
    supportsTablet: true,
    icon: './assets/icon.png',
    buildNumber: process.env.IOS_BUILD_NUMBER || '2',
    infoPlist: {
      NSCameraUsageDescription: 'This app needs access to camera to scan QR codes for adding 2FA services.',
    },
    bundleIdentifier: 'com.acktarius.concealauthenticator',
  },

  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    versionCode: parseInt(process.env.ANDROID_VERSION_CODE || '2'),
    permissions: ['CAMERA', 'android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
    package: 'com.acktarius.concealauthenticator',
  },

  plugins: [
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
          deploymentTarget: '15.1',
          useModularHeaders: true,
        },
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: '35.0.0',
          kotlinVersion: '2.2.0',
        },
        newArchEnabled: true,
        hermesEnabled: true,
        jsEngine: 'hermes',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Allow SecureAuth to access your camera to scan QR codes.',
      },
    ],
    './scripts/withNitroModulesPlugin',
    './withConcealConfigPlugin',
    './withCustomPodfile.plugin.js',
    'expo-secure-store',
    'expo-font',
  ],

  web: {
    bundler: 'metro',
  },

  extra: {
    eas: {
      projectId: 'b06dd25d-97c8-49c4-965e-d4f414bfbef3',
    },
    conceal: {
      defaultNodeUrl: process.env.CONCEAL_NODE_URL || 'https://explorer.conceal.network/daemon/',
      fallbackNodeUrl: 'https://ccxapi.conceal.network/daemon/',
      messageTxAmount: process.env.CONCEAL_MESSAGE_TX_AMOUNT || '100',
      defaultMixin: parseInt(process.env.CONCEAL_DEFAULT_MIXIN || '5'),
      coinUnitPlaces: 6,
      debugMode: process.env.DEBUG_MODE === 'true' || process.env.NODE_ENV !== 'production',
    },
    debugMode: process.env.DEBUG_MODE === 'true' || process.env.NODE_ENV !== 'production',
    apiUrl: process.env.CONCEAL_NODE_URL || 'https://ccxapi.conceal.network/',
  },

  owner: 'acktarius',
});
