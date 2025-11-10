#!/bin/bash

echo "🔄 Starting Android rebuild process..."

# Step 1: Remove existing android folder
echo "📁 Removing existing android folder..."
rm -rf android

# Step 2: Eject to recreate android and ios folders
echo "🚀 Running expo prebuild to recreate native folders..."
CI=1 npx expo prebuild --platform android --clean

# Step 3: Wait for prebuild to complete
echo "⏳ Waiting for prebuild to complete..."
sleep 5

# Step 4: Check if android folder was created
if [ ! -d "android" ]; then
    echo "❌ Error: android folder was not created!"
    exit 1
fi

echo "✅ Android folder recreated successfully!"

echo "🧹 Cleaning Android build..."
cd android
./gradlew clean
gradle_exit_code=$?
cd ..
if [ $gradle_exit_code -ne 0 ]; then
  echo "❌ Gradle clean failed!"
  exit 1
fi

# Step 5: Add Nitro init to MainApplication.kt
echo "🔄 Adding Nitro init to MainApplication.kt..."
sleep 2
node scripts/addNitroInit.js

# Step 6: Add build-extra.gradle
# echo "🔄 Adding build-extra.gradle to top of build.gradle..."
# sleep 2
# node hooks/android/1_extra.js

# Step 7: Add build-extra.gradle - needed for renaming apk for productionRelease builds
echo "🔄 Adding output filename to build-extra.gradle..."
sleep 2
node hooks/android/2_pre-build.js

# Step 8: Clean unwanted activity aliases (MUST be after 2_pre-build.js)
# echo "🧹 Cleaning unwanted activity aliases from AndroidManifest.xml..."
# sleep 2
# node hooks/android/22_clean_aliases.js

# Step 9: Signing/Unsigning prompts
# Accept command-line arguments or prompt interactively
# Usage: ./build-android.sh [sign_answer] [unsign_answer]
# Examples:
#   ./build-android.sh y          -> sign
#   ./build-android.sh n y        -> unsign for F-Droid
#   ./build-android.sh n n        -> neither
#   ./build-android.sh            -> interactive prompts

# Get sign answer from argument or prompt
if [ -n "$1" ]; then
  sign_answer=$(echo "$1" | tr '[:upper:]' '[:lower:]')
  echo "Sign build: $sign_answer (from argument)"
else
  read -p "Do you want to sign the build (for local build)? Yes|no: " sign_answer
  sign_answer=$(echo "$sign_answer" | tr '[:upper:]' '[:lower:]')
fi

if [ "$sign_answer" = "yes" ] || [ "$sign_answer" = "y" ]; then
  echo "🔄 Adding signature for local build..."
  sleep 2
  node hooks/android/3_signing.js
else
  # Get unsign answer from argument or prompt
  if [ -n "$2" ]; then
    unsign_answer=$(echo "$2" | tr '[:upper:]' '[:lower:]')
    echo "Unsign build: $unsign_answer (from argument)"
  else
    read -p "Do you want to unsign (repo ready for Fdroid)? Yes|no: " unsign_answer
    unsign_answer=$(echo "$unsign_answer" | tr '[:upper:]' '[:lower:]')
  fi
  
  if [ "$unsign_answer" = "yes" ] || [ "$unsign_answer" = "y" ]; then
    echo "🔄 Unsigning build for F-Droid..."
    sleep 2
    node hooks/android/31_unsign.js
    echo "✅ Unsign complete. Don't forget to tag vxxx-f-droid before pushing!"
  else
    echo "ℹ️  Neither sign or unsign. You will be ready for app-debug.apk"
  fi
fi


echo "Bundling!"
# npx react-native bundle --platform android --dev false --entry-file node_modules/expo/AppEntry.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res/
echo "📋 Next steps:"
echo "1. To Build APK locally, Run in android folder: ./gradlew assembleRelease to build the app"
echo "2. For Development: npx react-native run-android"
echo "3. and for development debugging: in separate terminal: npx expo start --android --reset-cache"
echo "4. Check Android Studio Logcat for multithreading test results"

