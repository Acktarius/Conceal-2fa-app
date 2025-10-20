const { withAppBuildGradle, withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');

function withConcealConfigPlugin(config) {
  // Android build.gradle modifications
  config = withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /defaultConfig \{/,
      (match) => `${match}\n        missingDimensionStrategy 'react-native-camera', 'general'`
    );

    // Add network security config for HTTP connections (if needed for blockchain nodes)
    config.modResults.contents = config.modResults.contents.replace(
      /android\s*\{/,
      (match) => `${match}\n    useLibrary 'org.apache.http.legacy'`
    );

    return config;
  });

  // Android manifest modifications
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // Ensure required permissions are present
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }

    const permissions = androidManifest.manifest['uses-permission'];
    const requiredPermissions = [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.VIBRATE',
    ];

    // Add missing permissions
    requiredPermissions.forEach((permission) => {
      const exists = permissions.some((p) => p.$['android:name'] === permission);
      if (!exists) {
        permissions.push({ $: { 'android:name': permission } });
      }
    });

    return config;
  });

  // Gradle properties modifications
  config = withGradleProperties(config, (config) => {
    // Add any custom gradle properties needed for Conceal 2FA
    config.modResults.push({
      type: 'property',
      key: 'org.gradle.jvmargs',
      value: '-Xmx4g -XX:MaxMetaspaceSize=512m',
    });

    return config;
  });

  return config;
}

module.exports = withConcealConfigPlugin;
