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

      if (!contents.includes('Yoga headers')) {
        contents = contents.replace(
          /post_install do \|installer\|/m,
          `post_install do |installer|
    # Inject custom fix for Yoga headers
    installer.pods_project.targets.each do |target|
      if target.name == "React-Fabric"
        target.build_configurations.each do |config|
          config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(SRCROOT)/Pods/Headers/Private/Yoga"'
        end
      end
    end`
        );
      }

      await fs.writeFile(podfilePath, contents);
      console.log('✅ Custom Podfile modifications applied');
      return cfg;
    },
  ]);
};

module.exports = withCustomPodfile;
