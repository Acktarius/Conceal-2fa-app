const { withAppBuildGradle } = require('@expo/config-plugins');

function withAndroidStrategiesPlugin(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /defaultConfig \{/,
      (match) => `${match}\n        missingDimensionStrategy 'react-native-camera', 'general'`
    );
    return config;
  });
}

module.exports = withAndroidStrategiesPlugin;
