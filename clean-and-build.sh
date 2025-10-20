#!/bin/bash

echo "=========================================="
echo "Cleaning all build artifacts..."
echo "=========================================="

# Clean Android builds
cd android
./gradlew clean
./gradlew cleanBuildCache
cd ..

# Remove all build directories
echo "Removing build directories..."
rm -rf android/build/
rm -rf android/app/build/
rm -rf android/.gradle/
rm -rf custom-quick-crypto/react-native-quick-crypto/android/build/
rm -rf custom-quick-crypto/react-native-quick-crypto/android/.cxx/
rm -rf custom-quick-crypto/react-native-quick-crypto/android/.transforms/

# Clear caches
echo "Clearing caches..."
rm -rf node_modules/.cache/
rm -rf .expo/

# Rebuild custom module
echo "=========================================="
echo "Rebuilding custom quick-crypto module..."
echo "=========================================="
cd custom-quick-crypto/react-native-quick-crypto/
npm run prepare
cd ../..

# Rebuild app
echo "=========================================="
echo "Building release APK..."
echo "=========================================="
cd android
./gradlew assembleRelease

echo "=========================================="
echo "Done!"
echo "=========================================="

