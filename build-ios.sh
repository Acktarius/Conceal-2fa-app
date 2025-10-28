#!/bin/bash

echo "🔄 Starting iOS rebuild process..."

# Step 1: Remove existing ios folder
echo "📁 Removing existing ios folder..."
rm -rf ios

# Step 2: Eject to recreate android and ios folders
echo "🚀 Running expo prebuild to recreate native folders..."
npx expo prebuild --platform ios --clean

# Step 3: Wait for prebuild to complete
echo "⏳ Waiting for prebuild to complete..."
sleep 5

# Step 4: Check if android folder was created
if [ ! -d "ios" ]; then
    echo "❌ Error: ios folder was not created!"
    exit 1
fi

echo "✅ ios folder recreated successfully!"


echo "📋 Next steps:"
echo "1. To Build Release, Run       : eas build -p ios --profile production"
echo "and then to push to Apple      : eas submit -p ios --latest"
echo "2. For Development and testing : eas build -p ios --profile preview"
echo "and for development debugging  : npx expo start --dev-client"
