#!/bin/bash
# Fix for F-Droid build
# This script applies necessary modifications to make the app buildable on F-Droid

set -e

echo "Applying F-Droid fixes..."

# Disable expo version catalog
sed -i 's/expoAutolinking\.useExpoVersionCatalog()/\/\/ expoAutolinking.useExpoVersionCatalog() \/\/ Disabled for F-Droid/' android/settings.gradle

# Add expo modules to settings.gradle
grep -q ':expo-asset' android/settings.gradle || echo -e 'include(":expo-asset")\nproject(":expo-asset").projectDir = new File(rootProject.projectDir, "../node_modules/expo-asset/android")' >> android/settings.gradle
grep -q ':expo-camera' android/settings.gradle || echo -e 'include(":expo-camera")\nproject(":expo-camera").projectDir = new File(rootProject.projectDir, "../node_modules/expo-camera/android")' >> android/settings.gradle
grep -q ':expo-clipboard' android/settings.gradle || echo -e 'include(":expo-clipboard")\nproject(":expo-clipboard").projectDir = new File(rootProject.projectDir, "../node_modules/expo-clipboard/android")' >> android/settings.gradle
grep -q ':expo-crypto' android/settings.gradle || echo -e 'include(":expo-crypto")\nproject(":expo-crypto").projectDir = new File(rootProject.projectDir, "../node_modules/expo-crypto/android")' >> android/settings.gradle
grep -q ':expo-file-system' android/settings.gradle || echo -e 'include(":expo-file-system")\nproject(":expo-file-system").projectDir = new File(rootProject.projectDir, "../node_modules/expo-file-system/android")' >> android/settings.gradle
grep -q ':expo-font' android/settings.gradle || echo -e 'include(":expo-font")\nproject(":expo-font").projectDir = new File(rootProject.projectDir, "../node_modules/expo-font/android")' >> android/settings.gradle
grep -q ':expo-keep-awake' android/settings.gradle || echo -e 'include(":expo-keep-awake")\nproject(":expo-keep-awake").projectDir = new File(rootProject.projectDir, "../node_modules/expo-keep-awake/android")' >> android/settings.gradle
grep -q ':expo-local-authentication' android/settings.gradle || echo -e 'include(":expo-local-authentication")\nproject(":expo-local-authentication").projectDir = new File(rootProject.projectDir, "../node_modules/expo-local-authentication/android")' >> android/settings.gradle
grep -q ':expo-secure-store' android/settings.gradle || echo -e 'include(":expo-secure-store")\nproject(":expo-secure-store").projectDir = new File(rootProject.projectDir, "../node_modules/expo-secure-store/android")' >> android/settings.gradle
grep -q ':expo-splash-screen' android/settings.gradle || echo -e 'include(":expo-splash-screen")\nproject(":expo-splash-screen").projectDir = new File(rootProject.projectDir, "../node_modules/expo-splash-screen/android")' >> android/settings.gradle

# Replace expo module dependencies with project references
sed -i 's/expo\.modules\.asset:expo\.modules\.asset:[0-9.]\+/project(":expo-asset")/g' node_modules/expo/android/build.gradle
sed -i 's/host\.exp\.exponent:expo\.modules\.camera:[0-9.]\+/project(":expo-camera")/g' node_modules/expo/android/build.gradle
sed -i 's/host\.exp\.exponent:expo\.modules\.clipboard:[0-9.]\+/project(":expo-clipboard")/g' node_modules/expo/android/build.gradle
sed -i 's/host\.exp\.exponent:expo\.modules\.crypto:[0-9.]\+/project(":expo-crypto")/g' node_modules/expo/android/build.gradle
sed -i 's/host\.exp\.exponent:expo\.modules\.filesystem:[0-9.]\+/project(":expo-file-system")/g' node_modules/expo/android/build.gradle
sed -i 's/host\.exp\.exponent:expo\.modules\.font:[0-9.]\+/project(":expo-font")/g' node_modules/expo/android/build.gradle
sed -i 's/host\.exp\.exponent:expo\.modules\.keepawake:[0-9.]\+/project(":expo-keep-awake")/g' node_modules/expo/android/build.gradle
sed -i 's/host\.exp\.exponent:expo\.modules\.localauthentication:[0-9.]\+/project(":expo-local-authentication")/g' node_modules/expo/android/build.gradle
sed -i 's/host\.exp\.exponent:expo\.modules\.securestore:[0-9.]\+/project(":expo-secure-store")/g' node_modules/expo/android/build.gradle
sed -i 's/host\.exp\.exponent:expo\.modules\.splashscreen:[0-9.]\+/project(":expo-splash-screen")/g' node_modules/expo/android/build.gradle

# Add dependency substitution for expo modules
if ! grep -q 'configurations.all { resolutionStrategy.dependencySubstitution' android/build.gradle; then
    echo 'allprojects { configurations.all { resolutionStrategy.dependencySubstitution { substitute module("expo.modules.asset:expo.modules.asset") using project(":expo-asset"); substitute module("host.exp.exponent:expo.modules.camera") using project(":expo-camera"); substitute module("host.exp.exponent:expo.modules.clipboard") using project(":expo-clipboard"); substitute module("host.exp.exponent:expo.modules.crypto") using project(":expo-crypto"); substitute module("host.exp.exponent:expo.modules.filesystem") using project(":expo-file-system"); substitute module("host.exp.exponent:expo.modules.font") using project(":expo-font"); substitute module("host.exp.exponent:expo.modules.keepawake") using project(":expo-keep-awake"); substitute module("host.exp.exponent:expo.modules.localauthentication") using project(":expo-local-authentication"); substitute module("host.exp.exponent:expo.modules.securestore") using project(":expo-secure-store"); substitute module("host.exp.exponent:expo.modules.splashscreen") using project(":expo-splash-screen"); } } }' >> android/build.gradle
fi

# Fix fresco version
sed -i 's/\${expoLibs\.versions\.fresco\.get()}/3.1.3/g' android/app/build.gradle
sed -i 's/expoLibs\.versions\.fresco\.get()/"3.1.3"/g' android/app/build.gradle

# Force project() references in expo autolinking
sed -i 's|handler\.add('\''api'\'', "${dependency\.group}:${projectName}:${dependency\.version}")|handler.add('\''api'\'', \ dependency)|g' node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle
sed -i 's|addModule(handler, moduleProject\.name, manager\.shouldUseAAR())|addModule(handler, moduleProject.name, false)|g' node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle
sed -i 's|return options?.useAAR == true|return false // Force project() references for F-Droid|g' node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle

# Remove problematic maven repositories
sed -i '/maven {[^}]*}$/d' android/build.gradle android/app/build.gradle node_modules/react-native-screens/android/build.gradle
sed -i '/maven.*url.*file:\/\//d' android/build.gradle android/app/build.gradle node_modules/react-native-screens/android/build.gradle
sed -i '/mavenLocal()/d' android/build.gradle android/app/build.gradle node_modules/react-native-screens/android/build.gradle
sed -i '/flatDir/d' android/build.gradle android/app/build.gradle node_modules/react-native-screens/android/build.gradle || true

# Add expo maven repository if needed
grep -q 'expo.dev/artifacts/public/maven' android/build.gradle || sed -i '/mavenCentral()/a\    maven { url "https://expo.dev/artifacts/public/maven" }' android/build.gradle

# Fix react-native-screens build.gradle
sed -i '/url "\${reactNativeRootDir}\/android"/d' node_modules/react-native-screens/android/build.gradle
sed -i '/^[[:space:]]*maven {$/,/^[[:space:]]*}$/d' node_modules/react-native-screens/android/build.gradle
if grep -q 'repositories {' node_modules/react-native-screens/android/build.gradle && ! grep -q 'google()' node_modules/react-native-screens/android/build.gradle; then
    sed -i '/^repositories {$/a\    google()\n    mavenCentral()' node_modules/react-native-screens/android/build.gradle
fi || true

# Fix react-native-screens version handling
sed -i 's|def REACT_NATIVE_VERSION = reactProperties.getProperty("VERSION_NAME")|def REACT_NATIVE_VERSION = reactProperties.getProperty("VERSION_NAME") ?: "0.0.0"|g' node_modules/react-native-screens/android/build.gradle
sed -i 's|REACT_NATIVE_VERSION\.startsWith("0\.0\.0-")|(REACT_NATIVE_VERSION != null \&\& REACT_NATIVE_VERSION.startsWith("0.0.0-"))|g' node_modules/react-native-screens/android/build.gradle
sed -i 's|REACT_NATIVE_VERSION\.split("\\\\\\\\\\.\")[1]\.toInteger()|(REACT_NATIVE_VERSION ? REACT_NATIVE_VERSION.split("\\\\.")[1].toInteger() : 0)|g' node_modules/react-native-screens/android/build.gradle
sed -i '/compileSdkVersion safeExtGet/a\    compileSdk safeExtGet('\''compileSdkVersion'\'', rnsDefaultCompileSdkVersion)' node_modules/react-native-screens/android/build.gradle

# Remove Google Play Services from react-native-camera (if still present)
if [ -d "node_modules/react-native-camera/android" ]; then
    # Remove gms and mlkit dependencies from build.gradle
    sed -i -e '/com\.google\.android\.gms/d' -e '/com\.google\.mlkit/d' node_modules/react-native-camera/android/build.gradle
    # Remove MLKit barcode scanner files if they exist
    find node_modules/react-native-camera/android/src -name "*MLKit*" -delete 2>/dev/null || true
fi

# Remove ML Kit from expo-camera (for F-Droid compatibility)
if [ -d "node_modules/expo-camera/android" ]; then
    # Remove gms and mlkit dependencies from build.gradle
    sed -i -e '/gms/d' -e '/mlkit/d' node_modules/expo-camera/android/build.gradle
    # Remove MLKit barcode scanner files and modify source code
    if [ -d "node_modules/expo-camera/android/src/main/java/expo/modules/camera" ]; then
        cd node_modules/expo-camera/android/src/main/java/expo/modules/camera
        rm -f analyzers/{BarcodeScannerResultSerializer,MLKitBarcodeAnalyzer}.kt 2>/dev/null || true
        sed -i -e '/@OptIn/,/^}/d' -e '/mlkit/d' analyzers/BarcodeAnalyzer.kt 2>/dev/null || true
        sed -i -e '/barcode\./Id' -e '/mapToBarcode/,/^  }/d' records/CameraRecords.kt 2>/dev/null || true
        sed -i -e '/mlkit/d' -e '/analyzers/d' -e '/onSuccess/,/^\s\{10\}}/s/^\s\{12\}.*//' -e '/launchScanner/,/^    }/s/^      .*//' CameraViewModule.kt 2>/dev/null || true
        sed -i -e '/analyzer.setAnalyzer/,/^\s\{10\})/d' -e '/BarcodeAnalyzer/d' ExpoCameraView.kt 2>/dev/null || true
        cd - > /dev/null
    fi
fi

# Global exclusions for Google Play Services in app/build.gradle
if ! grep -q 'configurations.all { exclude group: "com.google.android.gms"' android/app/build.gradle; then
    # Add packaging options to exclude GMS classes
    if ! grep -q 'packagingOptions' android/app/build.gradle; then
        sed -i '/android {/a\    packagingOptions {\n        exclude '\''**/com/google/android/gms/**'\''\n    }' android/app/build.gradle
    fi
    # Add dependency exclusions
    sed -i '/dependencies {/a\    configurations.all {\n        exclude group: "com.google.android.gms"\n        exclude group: "com.google.firebase"\n        exclude group: "com.google.mlkit"\n    }' android/app/build.gradle
fi

# Clean up
rm -rf node_modules/*/local-maven-repo
rm -rf fdroid-deps

echo "F-Droid fixes applied successfully!"

