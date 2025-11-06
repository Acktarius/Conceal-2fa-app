const { withGradleProperties } = require('expo/config-plugins');

/**
 * Expo config plugin to add -Xskip-metadata-version-check flag to Kotlin compilation
 * This allows Expo gradle plugins compiled with Kotlin 1.9.0 to use Kotlin 2.x stdlib
 * Must be set in gradle.properties to affect buildscript plugin compilations
 */
const withFixMetadataVersion = (config) => {
  return withGradleProperties(config, (config) => {
    const { modResults } = config;

    // Add kotlin compiler arg to skip metadata version check
    // This affects all Kotlin compilations including buildscript plugins
    modResults.push({
      type: 'property',
      key: 'kotlin.compiler.freeCompilerArgs',
      value: '-Xskip-metadata-version-check',
    });

    return config;
  });
};

module.exports = withFixMetadataVersion;
