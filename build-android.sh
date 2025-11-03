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
cd android && ./gradlew clean && cd ..


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


echo "Bundling!"
# npx react-native bundle --platform android --dev false --entry-file node_modules/expo/AppEntry.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res/
echo "📋 Next steps:"
echo "1. To Build APK, Run in android folder: ./gradlew assembleRelease to build the app"
echo "2. For Development: npx react-native run-android"
echo "3. and for development debugging: in separate terminal: npx expo start --android --reset-cache"
echo "4. Check Android Studio Logcat for multithreading test results"

