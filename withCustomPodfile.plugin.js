const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const withCustomPodfile = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents;
      try {
        contents = await fs.readFile(podfilePath, 'utf8');
      } catch {
        console.warn('⚠️ Podfile not found, skipping modification.');
        return cfg;
      }

      const hasYogaFix = contents.includes('Yoga headers');
      const hasReactCoreFix = contents.includes('React-Core-umbrella.h not found issue');

      if (!hasYogaFix || !hasReactCoreFix) {
        let fixesToAdd = '';

        if (!hasYogaFix) {
          fixesToAdd += `
    # Inject custom fix for Yoga headers
    installer.pods_project.targets.each do |target|
      if target.name == "React-Fabric"
        target.build_configurations.each do |config|
          config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(SRCROOT)/Pods/Headers/Private/Yoga"'
        end
      end
    end`;
        }

        if (!hasReactCoreFix) {
          fixesToAdd += `
    # Fix React-Core-umbrella.h not found issue for ExpoModulesCore
    # (ExpoDynamicAppIcon is handled by its podspec patch)
    installer.pods_project.targets.each do |target|
      if target.name == "ExpoModulesCore"
        target.build_configurations.each do |config|
          config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/Headers/Public/React-Core"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/React-Core"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_CONFIGURATION_BUILD_DIR)/React-Core/React-Core.framework/Headers"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(BUILT_PRODUCTS_DIR)/React-Core/React-Core.framework/Headers"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_BUILD_DIR)/React-Core"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_CONFIGURATION_BUILD_DIR)/React-Core"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(BUILT_PRODUCTS_DIR)/React-Core"'
          config.build_settings['FRAMEWORK_SEARCH_PATHS'] ||= ['$(inherited)']
          config.build_settings['FRAMEWORK_SEARCH_PATHS'] << '"$(PODS_CONFIGURATION_BUILD_DIR)/React-Core"'
          config.build_settings['FRAMEWORK_SEARCH_PATHS'] << '"$(BUILT_PRODUCTS_DIR)/React-Core"'
          config.build_settings['OTHER_CFLAGS'] ||= ['$(inherited)']
          config.build_settings['OTHER_CFLAGS'] << '-I"$(PODS_CONFIGURATION_BUILD_DIR)/React-Core/React-Core.framework/Headers"'
        end
      end
    end`;
        }

        if (fixesToAdd) {
          contents = contents.replace(/post_install do \|installer\|/m, `post_install do |installer|${fixesToAdd}`);
        }
      }

      await fs.writeFile(podfilePath, contents);
      console.log('✅ Custom Podfile modifications applied');
      return cfg;
    },
  ]);
};

module.exports = withCustomPodfile;
