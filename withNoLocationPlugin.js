const { withInfoPlist } = require('expo/config-plugins');

/**
 * Strips location-related Info.plist keys so the app does not declare or request
 * location on iOS. Use only when the app and all dependencies do NOT use Core
 * Location (no expo-location, maps, geofencing, or "show my location").
 *
 * SAFE because: we have no expo-location, react-native-maps, or any location
 * API in app code or dependencies. react-native-vision-camera is used for QR
 * scanning only; its location feature (GPS tags) is opt-in and not enabled in
 * our config. This plugin is a guard so no dependency accidentally re-adds keys.
 *
 * Before relying on this plugin, verify:
 * - No location entitlement is added in the Xcode target (Signing & Capabilities →
 *   Background Modes, Location Updates, etc.). After prebuild, check the generated
 *   ios/ project if needed.
 * - No dependency secretly bundles a location feature (e.g. SDK that can optionally
 *   use location for ads/analytics). If one does, add a purpose string or use a
 *   build variant without those APIs; do not rely on this plugin.
 *
 * If you ever add a library that uses location (maps, analytics, ads, or
 * expo-location): REMOVE this plugin and add proper NSLocation*UsageDescription
 * strings in ios.infoPlist instead. Otherwise ITMS-90683 will persist and
 * App Store review may reject.
 */
const LOCATION_PLIST_KEYS = [
  'NSLocationWhenInUseUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSLocationAlwaysUsageDescription',
  'NSLocationTemporaryUsageDescriptionDictionary',
  'NSLocationUsageDescription',
];

function withNoLocation(config) {
  return withInfoPlist(config, (config) => {
    const plist = config.modResults;

    LOCATION_PLIST_KEYS.forEach((key) => {
      if (plist[key] !== undefined) {
        delete plist[key];
      }
    });

    if (Array.isArray(plist.UIBackgroundModes)) {
      plist.UIBackgroundModes = plist.UIBackgroundModes.filter(
        (mode) => mode !== 'location'
      );
    }

    // Remove location from required device capabilities if a dependency added it
    if (Array.isArray(plist.UIRequiredDeviceCapabilities)) {
      const locationRelated = ['location-services', 'gps'];
      plist.UIRequiredDeviceCapabilities = plist.UIRequiredDeviceCapabilities.filter(
        (cap) => !locationRelated.includes(cap)
      );
    }

    return config;
  });
}

module.exports = withNoLocation;
