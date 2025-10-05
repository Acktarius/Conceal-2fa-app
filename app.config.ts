import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.NODE_ENV === 'production' ? 'Conceal 2FA' : 'Conceal 2FA (Dev)',
  version: process.env.APP_VERSION || '1.0.0',
  slug: 'conceal-2fa-app',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  
  ios: {
    supportsTablet: true,
    icon: './assets/icon.png',
    infoPlist: {
      NSCameraUsageDescription: 'This app needs access to camera to scan QR codes for adding 2FA services.'
    },
    bundleIdentifier: 'com.acktarius.conceal2faapp'
  },
  
  android: {
    icon: './assets/icon.png',
    permissions: [
      'CAMERA',
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO'
    ],
    package: 'com.acktarius.conceal2faapp'
  },
  
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: '35.0.0',
          kotlinVersion: '2.2.0',
          'org.gradle.java.home': '/usr/lib/jvm/java-17-openjdk-amd64',
          androidSdkPath: '/home/katana/Android/Sdk',
          'android.abiFilters': 'armeabi-v7a,arm64-v8a,x86,x86_64',
          newArchEnabled: true,
          hermesEnabled: true
        },
        jsEngine: 'hermes'
      }
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Allow SecureAuth to access your camera to scan QR codes.'
      }
    ],
    './withConcealConfigPlugin',
    'expo-secure-store',
    'expo-font'
  ],
  
  web: {
    bundler: 'metro'
  },
  
  extra: {
    eas: {
      projectId: '6ec1baed-9051-4552-8949-cb824a416c11'
    },
    conceal: {
      defaultNodeUrl: process.env.CONCEAL_NODE_URL || 'https://explorer.conceal.network/daemon/',
      fallbackNodeUrl: 'https://ccxapi.conceal.network/daemon/',
      messageTxAmount: process.env.CONCEAL_MESSAGE_TX_AMOUNT || '100',
      defaultMixin: parseInt(process.env.CONCEAL_DEFAULT_MIXIN || '5'),
      coinUnitPlaces: 6,
      debugMode: process.env.DEBUG_MODE === 'true' || process.env.NODE_ENV !== 'production'
    },
    debugMode: process.env.DEBUG_MODE === 'true' || process.env.NODE_ENV !== 'production',
    apiUrl: process.env.CONCEAL_NODE_URL || 'https://ccxapi.conceal.network/'
  },
  
  owner: 'acktarius'
});
