import type { ConfigContext, ExpoConfig } from 'expo/config';
import 'dotenv/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Conceal Authenticator',
  version: process.env.APP_VERSION || '1.0.0',
  slug: 'conceal-authenticator',
  orientation: 'portrait',
  icon: './assets/icon.png',
  splash: {
    image: './assets/icon.png',
    resizeMode: 'contain',
    backgroundColor: '#000000',
  },
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],

  ios: {
    supportsTablet: false,
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash-ios.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    buildNumber: process.env.IOS_BUILD_NUMBER || '2',
    infoPlist: {
      NSCameraUsageDescription: 'Allow SecureAuth to access your camera to scan QR codes.',
      ITSAppUsesNonExemptEncryption: true,
      NSLocationWhenInUseUsageDescription:
        'This app does not use your location. This message is required because a bundled library may reference location APIs; we do not collect or use location data.',
    },
    bundleIdentifier: 'com.acktarius.concealauthenticator',
  },

  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    versionCode: parseInt(process.env.ANDROID_VERSION_CODE || '2'),
    permissions: ['CAMERA', 'android.permission.CAMERA'],
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
    // UNCERTAINTY: This plugin might be causing build issues for iOS, but it's not clear why.
    [
      '@g9k/expo-dynamic-app-icon',
      {
        // iOS config removed - plugin won't be applied to iOS builds
        pink: {
          ios: './assets/icon-pink-1024.png',
          android: {
            foregroundImage: './assets/icon-android-pink-1024.png',
            backgroundColor: '#000000',
          },
        },
        velvet: {
          ios: './assets/icon-velvet-1024.png',
          android: {
            foregroundImage: './assets/icon-android-velvet-1024.png',
            backgroundColor: '#000000',
          },
        },
        orange: {
          ios: './assets/icon-orange-1024.png',
          android: {
            foregroundImage: './assets/icon-android-orange-1024.png',
            backgroundColor: '#000000',
          },
        },
        light: {
          ios: './assets/icon-blue-1024.png',
          android: {
            foregroundImage: './assets/icon-android-blue-1024.png',
            backgroundColor: '#000000',
          },
        },
        dark: {
          ios: './assets/icon-orange-1024.png',
          android: {
            foregroundImage: './assets/icon-android-orange-1024.png',
            backgroundColor: '#000000',
          },
        },
      },
    ],
    './scripts/withNitroModulesPlugin',
    './withConcealConfigPlugin',
    './withCustomPodfile.plugin.js',
    './withFixMetadataVersion.plugin.js',
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
