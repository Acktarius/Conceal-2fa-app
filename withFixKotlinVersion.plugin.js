const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Expo config plugin to ensure Kotlin Gradle plugin version matches kotlinVersion
 * from expo-build-properties. This fixes version mismatch issues.
 */
const withFixKotlinVersion = (config) => {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const buildGradlePath = path.join(cfg.modRequest.platformProjectRoot, 'build.gradle');
      let contents;
      try {
        contents = await fs.readFile(buildGradlePath, 'utf8');
      } catch {
        console.warn('⚠️ android/build.gradle not found, skipping Kotlin version fix.');
        return cfg;
      }

      const kotlinVersion = cfg.modRequest.projectRoot ? await getKotlinVersionFromConfig(cfg.modRequest.projectRoot) : '2.2.0'; // fallback

      // Check if Kotlin version is already set
      if (contents.includes("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:")) {
        // Replace any existing version with the correct one
        contents = contents.replace(
          /classpath\('org\.jetbrains\.kotlin:kotlin-gradle-plugin:[^']+'\)/,
          `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}')`
        );
      } else if (contents.includes("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')")) {
        // No version specified, add it
        contents = contents.replace(
          "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
          `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}')`
        );
      } else {
        // Kotlin plugin not found - this shouldn't happen, but handle it
        console.warn('⚠️ Kotlin Gradle plugin not found in build.gradle');
      }

      // Also ensure allprojects block has Kotlin compiler flags
      if (!contents.includes('tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile)')) {
        // Find allprojects block and add Kotlin compiler configuration
        if (contents.includes('allprojects {')) {
          contents = contents.replace(
            /(allprojects \{[\s\S]*?repositories \{[\s\S]*?\}[\s]*)(\})/,
            `$1  
  // Apply -Xskip-metadata-version-check to all Kotlin compilations including composite builds
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    kotlinOptions {
      freeCompilerArgs += ['-Xskip-metadata-version-check']
    }
  }
$2`
          );
        }
      }

      await fs.writeFile(buildGradlePath, contents);
      console.log('✅ Kotlin Gradle plugin version fixed');
      return cfg;
    },
  ]);
};

async function getKotlinVersionFromConfig(projectRoot) {
  try {
    const appConfigPath = path.join(projectRoot, 'app.config.ts');
    const contents = await fs.readFile(appConfigPath, 'utf8');
    const match = contents.match(/kotlinVersion:\s*['"]([^'"]+)['"]/);
    return match ? match[1] : '2.2.0';
  } catch {
    return '2.2.0'; // fallback
  }
}

module.exports = withFixKotlinVersion;
