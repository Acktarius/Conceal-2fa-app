const { withGradleProperties } = require('expo/config-plugins');

/**
 * Expo config plugin for build-related fixes:
 * - Kotlin metadata version check fix
 * - Memory settings for CI builds (Metaspace)
 * - Architecture settings (phone-only builds)
 */
const withFixMetadataVersion = (config) => {
  return withGradleProperties(config, (config) => {
    const { modResults } = config;

    // Find and replace existing properties or add new ones
    const propertiesToSet = {
      // Kotlin metadata version check fix (allows Kotlin 1.9.0 plugins to use Kotlin 2.x stdlib)
      'kotlin.compiler.freeCompilerArgs': '-Xskip-metadata-version-check',
      'org.jetbrains.kotlin.compiler.freeCompilerArgs': '-Xskip-metadata-version-check',
      // Memory settings for CI builds (prevents Metaspace OutOfMemoryError during lint)
      'org.gradle.jvmargs': '-Xmx4g -XX:MaxMetaspaceSize=2g',
    };
    
    // Remove existing properties with these keys
    const filtered = modResults.filter(
      (item) => !(item.type === 'property' && propertiesToSet.hasOwnProperty(item.key))
    );
    
    // Add the new/updated properties
    Object.entries(propertiesToSet).forEach(([key, value]) => {
      filtered.push({
        type: 'property',
        key: key,
        value: value,
      });
    });
    
    config.modResults = filtered;
    return config;
  });
};

module.exports = withFixMetadataVersion;
