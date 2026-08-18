#!/bin/bash
# Script to collect Expo module POM/AAR files for F-Droid builds
# These files are needed because F-Droid can't access Maven/Jitpack

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="$PROJECT_ROOT/fdroid-deps"
NODE_MODULES="$PROJECT_ROOT/node_modules"

echo "📦 Collecting Expo module dependencies for F-Droid..."

# Create vendor directory
mkdir -p "$VENDOR_DIR"

# Find all POM and AAR files in local-maven-repo
find "$NODE_MODULES" -path "*/local-maven-repo/*" -type f \( -name "*.pom" -o -name "*.aar" \) | while read -r file; do
    # Get relative path from node_modules
    rel_path="${file#$NODE_MODULES/}"
    
    # Extract module name (e.g., expo-file-system from node_modules/expo-file-system/...)
    module_name=$(echo "$rel_path" | cut -d'/' -f1)
    
    # Create target directory structure: fdroid-deps/expo-file-system/local-maven-repo/...
    target_dir="$VENDOR_DIR/$module_name/$(dirname "${rel_path#*/local-maven-repo/}")"
    mkdir -p "$target_dir"
    
    # Copy file
    cp "$file" "$target_dir/"
    echo "  ✅ Copied: $rel_path"
done

# Count files
POM_COUNT=$(find "$VENDOR_DIR" -name "*.pom" | wc -l)
AAR_COUNT=$(find "$VENDOR_DIR" -name "*.aar" | wc -l)

echo ""
echo "✅ Collected $POM_COUNT POM files and $AAR_COUNT AAR files"
echo "📁 Files are in: $VENDOR_DIR"
echo ""
echo "Next steps:"
echo "1. Review the files: ls -R $VENDOR_DIR"
echo "2. Add to git: git add $VENDOR_DIR"
echo "3. Commit: git commit -m 'Add Expo module dependencies for F-Droid'"
echo ""
echo "Then update F-Droid prebuild to copy these files:"
echo "  - cp -r fdroid-deps/* node_modules/"

