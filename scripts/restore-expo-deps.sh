#!/bin/bash
# Script to restore Expo module POM/AAR files from fdroid-deps during F-Droid build
# This is called in the F-Droid prebuild step

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="$PROJECT_ROOT/fdroid-deps"
NODE_MODULES="$PROJECT_ROOT/node_modules"

if [ ! -d "$VENDOR_DIR" ]; then
    echo "⚠️  fdroid-deps directory not found, skipping dependency restoration"
    exit 0
fi

echo "📦 Restoring Expo module dependencies from fdroid-deps..."

# Copy each module's local-maven-repo to node_modules
for module_dir in "$VENDOR_DIR"/*; do
    if [ -d "$module_dir" ]; then
        module_name=$(basename "$module_dir")
        target_module="$NODE_MODULES/$module_name"
        
        if [ -d "$target_module" ]; then
            # Copy local-maven-repo if it exists
            if [ -d "$module_dir/local-maven-repo" ]; then
                mkdir -p "$target_module/local-maven-repo"
                cp -r "$module_dir/local-maven-repo"/* "$target_module/local-maven-repo/" 2>/dev/null || true
                echo "  ✅ Restored: $module_name"
            fi
        else
            echo "  ⚠️  Module not found in node_modules: $module_name"
        fi
    fi
done

POM_COUNT=$(find "$NODE_MODULES" -path "*/local-maven-repo/*" -name "*.pom" 2>/dev/null | wc -l)
AAR_COUNT=$(find "$NODE_MODULES" -path "*/local-maven-repo/*" -name "*.aar" 2>/dev/null | wc -l)

echo ""
echo "✅ Restored $POM_COUNT POM files and $AAR_COUNT AAR files"

