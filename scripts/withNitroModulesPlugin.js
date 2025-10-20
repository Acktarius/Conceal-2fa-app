const { withSettingsGradle } = require('@expo/config-plugins')

module.exports = function withNitroModulesPlugin(config) {
  return withSettingsGradle(config, (cfg) => {
    const nitroBlock = `
include(":react-native-nitro-modules")
project(":react-native-nitro-modules").projectDir = new File(rootProject.projectDir, "../node_modules/react-native-nitro-modules/android")
`
    if (!cfg.modResults.contents.includes('react-native-nitro-modules')) {
      cfg.modResults.contents += `\n// Added by withNitroModulesPlugin\n${nitroBlock}`
    }
    return cfg
  })
}

