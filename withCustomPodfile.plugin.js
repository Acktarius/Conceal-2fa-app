const { withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const fs = require('node:fs/promises');
const path = require('node:path');

function addYogaFix(src) {
  return mergeContents({
    tag: 'yoga-headers-fix',
    src,
    newSrc: `    # Inject custom fix for Yoga headers
    installer.pods_project.targets.each do |target|
      if target.name == "React-Fabric"
        target.build_configurations.each do |config|
          config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(SRCROOT)/Pods/Headers/Private/Yoga"'
        end
      end
    end
`,
    anchor: /post_install do \|installer\|/,
    offset: 1,
    comment: '#',
  });
}

function addReactCoreFix(src) {
  return mergeContents({
    tag: 'react-core-umbrella-fix',
    src,
    newSrc: `    # Fix React-Core-umbrella.h not found issue for ExpoModulesCore
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
    end
`,
    anchor: /post_install do \|installer\|/,
    offset: 1,
    comment: '#',
  });
}

function addVisionCameraFix(src) {
  return mergeContents({
    tag: 'vision-camera-zxing-fix',
    src,
    newSrc: `    # Fix VisionCamera/FrameProcessorPlugin.h not found issue for VisionCameraZXing
    installer.pods_project.targets.each do |target|
      if target.name == "VisionCameraZXing"
        target.build_configurations.each do |config|
          config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/Headers/Public/VisionCamera"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/VisionCamera"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_CONFIGURATION_BUILD_DIR)/VisionCamera/VisionCamera.framework/Headers"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(BUILT_PRODUCTS_DIR)/VisionCamera/VisionCamera.framework/Headers"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_BUILD_DIR)/VisionCamera"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_CONFIGURATION_BUILD_DIR)/VisionCamera"'
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(BUILT_PRODUCTS_DIR)/VisionCamera"'
          config.build_settings['FRAMEWORK_SEARCH_PATHS'] ||= ['$(inherited)']
          config.build_settings['FRAMEWORK_SEARCH_PATHS'] << '"$(PODS_CONFIGURATION_BUILD_DIR)/VisionCamera"'
          config.build_settings['FRAMEWORK_SEARCH_PATHS'] << '"$(BUILT_PRODUCTS_DIR)/VisionCamera"'
          config.build_settings['OTHER_CFLAGS'] ||= ['$(inherited)']
          config.build_settings['OTHER_CFLAGS'] << '-I"$(PODS_CONFIGURATION_BUILD_DIR)/VisionCamera/VisionCamera.framework/Headers"'
        end
      end
    end
`,
    anchor: /react_native_post_install\(/,
    offset: 0,
    comment: '#',
  });
}

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

      let modified = false;

      // Apply Yoga fix
      if (!contents.includes('yoga-headers-fix')) {
        const yogaResult = addYogaFix(contents);
        if (yogaResult.didMerge) {
          contents = yogaResult.contents;
          modified = true;
          console.log('✅ Applied Yoga headers fix');
        } else {
          console.warn('⚠️ Failed to merge Yoga fix – check anchor/Podfile template');
        }
      }

      // Apply React-Core fix
      if (!contents.includes('react-core-umbrella-fix')) {
        const reactCoreResult = addReactCoreFix(contents);
        if (reactCoreResult.didMerge) {
          contents = reactCoreResult.contents;
          modified = true;
          console.log('✅ Applied React-Core umbrella fix');
        } else {
          console.warn('⚠️ Failed to merge React-Core fix – check anchor/Podfile template');
        }
      }

      // Apply VisionCamera fix
      if (!contents.includes('vision-camera-zxing-fix')) {
        const visionCameraResult = addVisionCameraFix(contents);
        if (visionCameraResult.didMerge) {
          contents = visionCameraResult.contents;
          modified = true;
          console.log('✅ Applied VisionCameraZXing fix');
        } else {
          console.warn('⚠️ Failed to merge VisionCamera fix – check anchor/Podfile template');
        }
      }

      if (modified) {
        await fs.writeFile(podfilePath, contents);
        console.log('✅ Custom Podfile modifications applied');
      }

      return cfg;
    },
  ]);
};

module.exports = withCustomPodfile;
