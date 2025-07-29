const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver to handle expo-modules-core for web platform
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === 'expo-modules-core' && platform === 'web') {
      return {
        filePath: require.resolve('expo-modules-core/web'),
        type: 'sourceFile',
      };
    }
    // Fall back to the default resolver
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;