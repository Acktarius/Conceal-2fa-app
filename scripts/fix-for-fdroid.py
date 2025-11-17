#!/usr/bin/env python3
"""
Fix for F-Droid build
This script applies necessary modifications to make the app buildable on F-Droid
"""

import os
import re
import sys
import shutil
from pathlib import Path
from typing import Optional


class Colors:
    """Terminal colors for output"""
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color


def log(message: str, color: str = Colors.NC):
    """Print colored log message"""
    print(f"{color}{message}{Colors.NC}")


def read_file(file_path: Path) -> str:
    """Read file content"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        log(f"Error reading {file_path}: {e}", Colors.RED)
        raise


def write_file(file_path: Path, content: str):
    """Write file content"""
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        log(f"Error writing {file_path}: {e}", Colors.RED)
        raise


def file_contains(file_path: Path, pattern: str) -> bool:
    """Check if file contains pattern"""
    if not file_path.exists():
        return False
    try:
        content = read_file(file_path)
        return pattern in content
    except:
        return False


def replace_in_file(file_path: Path, pattern: str, replacement: str, count: int = 0, flags: int = 0):
    """Replace pattern in file"""
    if not file_path.exists():
        return False
    try:
        content = read_file(file_path)
        if count == 0:
            if flags:
                new_content = re.sub(pattern, replacement, content, flags=flags)
            else:
                new_content = re.sub(pattern, replacement, content)
        else:
            if flags:
                new_content = re.sub(pattern, replacement, content, count=count, flags=flags)
            else:
                new_content = re.sub(pattern, replacement, content, count=count)
        if new_content != content:
            write_file(file_path, new_content)
            return True
        return False
    except Exception as e:
        log(f"Error replacing in {file_path}: {e}", Colors.YELLOW)
        return False


def append_to_file(file_path: Path, content: str):
    """Append content to file"""
    try:
        with open(file_path, 'a', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        log(f"Error appending to {file_path}: {e}", Colors.RED)
        raise


def fix_expo_version_catalog(project_root: Path):
    """Disable expo version catalog"""
    log("Disabling expo version catalog...")
    settings_gradle = project_root / "android" / "settings.gradle"
    if settings_gradle.exists():
        replace_in_file(
            settings_gradle,
            r'expoAutolinking\.useExpoVersionCatalog\(\)',
            '// expoAutolinking.useExpoVersionCatalog() // Disabled for F-Droid'
        )


def add_expo_modules_to_settings(project_root: Path):
    """Add expo modules to settings.gradle"""
    log("Adding expo modules to settings.gradle...")
    settings_gradle = project_root / "android" / "settings.gradle"
    
    expo_modules = [
        ("expo-asset", "expo-asset"),
        ("expo-clipboard", "expo-clipboard"),
        ("expo-crypto", "expo-crypto"),
        ("expo-file-system", "expo-file-system"),
        ("expo-font", "expo-font"),
        ("expo-keep-awake", "expo-keep-awake"),
        ("expo-local-authentication", "expo-local-authentication"),
        ("expo-secure-store", "expo-secure-store"),
        ("expo-splash-screen", "expo-splash-screen"),
    ]
    
    if not settings_gradle.exists():
        log(f"Warning: {settings_gradle} not found", Colors.YELLOW)
        return
    
    content = read_file(settings_gradle)
    
    for module_id, module_name in expo_modules:
        if f':{module_id}' not in content:
            include_line = f'include("{module_id}")\n'
            project_line = f'project(":{module_id}").projectDir = new File(rootProject.projectDir, "../node_modules/{module_name}/android")\n'
            append_to_file(settings_gradle, include_line + project_line)


def replace_expo_module_dependencies(project_root: Path):
    """Replace expo module dependencies with project references"""
    log("Replacing expo module dependencies...")
    expo_build_gradle = project_root / "node_modules" / "expo" / "android" / "build.gradle"
    
    if not expo_build_gradle.exists():
        log(f"Warning: {expo_build_gradle} not found", Colors.YELLOW)
        return
    
    replacements = [
        (r'expo\.modules\.asset:expo\.modules\.asset:[0-9.]+', 'project(":expo-asset")'),
        (r'host\.exp\.exponent:expo\.modules\.clipboard:[0-9.]+', 'project(":expo-clipboard")'),
        (r'host\.exp\.exponent:expo\.modules\.crypto:[0-9.]+', 'project(":expo-crypto")'),
        (r'host\.exp\.exponent:expo\.modules\.filesystem:[0-9.]+', 'project(":expo-file-system")'),
        (r'host\.exp\.exponent:expo\.modules\.font:[0-9.]+', 'project(":expo-font")'),
        (r'host\.exp\.exponent:expo\.modules\.keepawake:[0-9.]+', 'project(":expo-keep-awake")'),
        (r'host\.exp\.exponent:expo\.modules\.localauthentication:[0-9.]+', 'project(":expo-local-authentication")'),
        (r'host\.exp\.exponent:expo\.modules\.securestore:[0-9.]+', 'project(":expo-secure-store")'),
        (r'host\.exp\.exponent:expo\.modules\.splashscreen:[0-9.]+', 'project(":expo-splash-screen")'),
    ]
    
    for pattern, replacement in replacements:
        replace_in_file(expo_build_gradle, pattern, replacement)


def add_dependency_substitution(project_root: Path):
    """Add dependency substitution for expo modules"""
    log("Adding dependency substitution...")
    build_gradle = project_root / "android" / "build.gradle"
    
    if not build_gradle.exists():
        log(f"Warning: {build_gradle} not found", Colors.YELLOW)
        return
    
    if file_contains(build_gradle, 'configurations.all { resolutionStrategy.dependencySubstitution'):
        return
    
    substitution = '''
allprojects { configurations.all { resolutionStrategy.dependencySubstitution { substitute module("expo.modules.asset:expo.modules.asset") using project(":expo-asset"); substitute module("host.exp.exponent:expo.modules.clipboard") using project(":expo-clipboard"); substitute module("host.exp.exponent:expo.modules.crypto") using project(":expo-crypto"); substitute module("host.exp.exponent:expo.modules.filesystem") using project(":expo-file-system"); substitute module("host.exp.exponent:expo.modules.font") using project(":expo-font"); substitute module("host.exp.exponent:expo.modules.keepawake") using project(":expo-keep-awake"); substitute module("host.exp.exponent:expo.modules.localauthentication") using project(":expo-local-authentication"); substitute module("host.exp.exponent:expo.modules.securestore") using project(":expo-secure-store"); substitute module("host.exp.exponent:expo.modules.splashscreen") using project(":expo-splash-screen"); } } }
'''
    append_to_file(build_gradle, substitution)


def fix_fresco_version(project_root: Path):
    """Fix fresco version"""
    log("Fixing fresco version...")
    app_build_gradle = project_root / "android" / "app" / "build.gradle"
    
    if app_build_gradle.exists():
        replace_in_file(app_build_gradle, r'\$\{expoLibs\.versions\.fresco\.get\(\)\}', '3.1.3')
        replace_in_file(app_build_gradle, r'expoLibs\.versions\.fresco\.get\(\)', '"3.1.3"')


def fix_expo_autolinking(project_root: Path):
    """Force project() references in expo autolinking"""
    log("Fixing expo autolinking...")
    autolinking_gradle = project_root / "node_modules" / "expo-modules-autolinking" / "scripts" / "android" / "autolinking_implementation.gradle"
    
    if not autolinking_gradle.exists():
        log(f"Warning: {autolinking_gradle} not found", Colors.YELLOW)
        return
    
    replacements = [
        (r"handler\.add\('api',\s*\"\$\{dependency\.group\}:\$\{projectName\}:\$\{dependency\.version\}\"\)", "handler.add('api', dependency)"),
        (r'addModule\(handler,\s*moduleProject\.name,\s*manager\.shouldUseAAR\(\)\)', 'addModule(handler, moduleProject.name, false)'),
        (r'return\s+options\?\.useAAR\s*==\s*true', 'return false // Force project() references for F-Droid'),
    ]
    
    for pattern, replacement in replacements:
        try:
            replace_in_file(autolinking_gradle, pattern, replacement)
        except Exception as e:
            log(f"  Warning: Could not apply pattern {pattern[:50]}...: {e}", Colors.YELLOW)


def remove_problematic_maven_repos(project_root: Path):
    """Remove problematic maven repositories"""
    log("Removing problematic maven repositories...")
    
    files_to_fix = [
        project_root / "android" / "build.gradle",
        project_root / "android" / "app" / "build.gradle",
        project_root / "node_modules" / "react-native-screens" / "android" / "build.gradle",
    ]
    
    patterns_to_remove = [
        (r'maven \{[^}]*\}$', re.MULTILINE),
        (r'maven.*url.*file://', re.MULTILINE),
        (r'mavenLocal\(\)', re.MULTILINE),
        (r'flatDir', re.MULTILINE),
    ]
    
    for file_path in files_to_fix:
        if file_path.exists():
            for pattern, flags in patterns_to_remove:
                replace_in_file(file_path, pattern, '', flags=flags)


def add_expo_maven_repo(project_root: Path):
    """Add expo maven repository if needed"""
    log("Adding expo maven repository...")
    build_gradle = project_root / "android" / "build.gradle"
    
    if not build_gradle.exists():
        return
    
    if not file_contains(build_gradle, 'expo.dev/artifacts/public/maven'):
        content = read_file(build_gradle)
        content = re.sub(
            r'(mavenCentral\(\))',
            r'\1\n    maven { url "https://expo.dev/artifacts/public/maven" }',
            content
        )
        write_file(build_gradle, content)


def fix_react_native_screens(project_root: Path):
    """Fix react-native-screens build.gradle"""
    log("Fixing react-native-screens...")
    screens_gradle = project_root / "node_modules" / "react-native-screens" / "android" / "build.gradle"
    
    if not screens_gradle.exists():
        log(f"Warning: {screens_gradle} not found", Colors.YELLOW)
        return
    
    # Remove problematic URL
    replace_in_file(screens_gradle, r'url "\$\{reactNativeRootDir\}/android"', '')
    
    # Remove empty maven blocks
    content = read_file(screens_gradle)
    content = re.sub(r'^\s*maven \{\s*\n\s*\}\s*\n', '', content, flags=re.MULTILINE)
    write_file(screens_gradle, content)
    
    # Add google() and mavenCentral() if repositories block exists but doesn't have google()
    if 'repositories {' in content and 'google()' not in content:
        content = re.sub(
            r'(repositories \{)',
            r'\1\n    google()\n    mavenCentral()',
            content
        )
        write_file(screens_gradle, content)
    
    # Fix version handling
    replacements = [
        (r'def REACT_NATIVE_VERSION = reactProperties\.getProperty\("VERSION_NAME"\)',
         'def REACT_NATIVE_VERSION = reactProperties.getProperty("VERSION_NAME") ?: "0.0.0"'),
        (r'REACT_NATIVE_VERSION\.startsWith\("0\.0\.0-"\)',
         '(REACT_NATIVE_VERSION != null && REACT_NATIVE_VERSION.startsWith("0.0.0-"))'),
        (r'REACT_NATIVE_VERSION\.split\("\\\\\\\\.\."\)\[1\]\.toInteger\(\)',
         '(REACT_NATIVE_VERSION ? REACT_NATIVE_VERSION.split("\\\\.")[1].toInteger() : 0)'),
    ]
    
    for pattern, replacement in replacements:
        replace_in_file(screens_gradle, pattern, replacement)
    
    # Add compileSdk after compileSdkVersion safeExtGet (only if not already present)
    # Read content again to get latest state
    content = read_file(screens_gradle)
    
    # Check if compileSdk line already exists (avoid duplicates)
    has_compile_sdk = 'compileSdk safeExtGet' in content
    
    if 'compileSdkVersion safeExtGet' in content and not has_compile_sdk:
        # Find the line with compileSdkVersion and add compileSdk after it
        lines = content.split('\n')
        new_lines = []
        for i, line in enumerate(lines):
            new_lines.append(line)
            # If this line has compileSdkVersion safeExtGet, add compileSdk line after it
            if 'compileSdkVersion safeExtGet' in line and not has_compile_sdk:
                # Extract indentation from the current line
                indent = len(line) - len(line.lstrip())
                new_lines.append(' ' * indent + "compileSdk safeExtGet('compileSdkVersion', rnsDefaultCompileSdkVersion)")
                has_compile_sdk = True  # Prevent adding it again
        
        content = '\n'.join(new_lines)
        write_file(screens_gradle, content)
    
    # Also fix any duplicate or malformed lines that might have been created
    content = read_file(screens_gradle)
    lines = content.split('\n')
    new_lines = []
    seen_compile_sdk = False
    
    for line in lines:
        # Fix malformed lines with escaped quotes or duplicates
        if 'compileSdk safeExtGet' in line:
            # Skip if we've already seen a compileSdk line (duplicate)
            if seen_compile_sdk:
                continue
            
            # Fix the entire malformed line - reconstruct it properly
            indent = len(line) - len(line.lstrip())
            # Always reconstruct to ensure correct format
            line = ' ' * indent + "compileSdk safeExtGet('compileSdkVersion', rnsDefaultCompileSdkVersion)"
            
            new_lines.append(line)
            seen_compile_sdk = True
        else:
            new_lines.append(line)
    
    if len(new_lines) != len(lines):
        content = '\n'.join(new_lines)
        write_file(screens_gradle, content)
        log("  Fixed duplicate/malformed compileSdk line", Colors.GREEN)


def remove_mlkit_from_react_native_camera(project_root: Path):
    """Remove Google Play Services from react-native-camera"""
    log("Removing MLKit from react-native-camera...")
    camera_dir = project_root / "node_modules" / "react-native-camera" / "android"
    
    if not camera_dir.exists():
        return
    
    build_gradle = camera_dir / "build.gradle"
    if build_gradle.exists():
        replace_in_file(build_gradle, r'com\.google\.android\.gms', '')
        replace_in_file(build_gradle, r'com\.google\.mlkit', '')
    
    # Remove MLKit files
    src_dir = camera_dir / "src"
    if src_dir.exists():
        for mlkit_file in src_dir.rglob("*MLKit*"):
            try:
                mlkit_file.unlink()
                log(f"  Removed {mlkit_file.relative_to(project_root)}", Colors.GREEN)
            except Exception as e:
                log(f"  Warning: Could not remove {mlkit_file}: {e}", Colors.YELLOW)


def fix_camera_view_module(file_path: Path):
    """Fix CameraViewModule.kt by removing MLKit code using bracket counting"""
    if not file_path.exists():
        return
    
    content = read_file(file_path)
    lines = content.split('\n')
    new_lines = []
    
    # Track what we need to add back
    needs_companion_object = False
    if 'companion object' not in content and 'TAG' in content:
        needs_companion_object = True
    
    # Functions/properties to remove - we know their starting patterns
    mlkit_removals = [
        ('AsyncFunction("scanFromURLAsync")', 'scanFromURLAsync'),
        ('AsyncFunction("launchScanner")', 'launchScanner'),
        ('AsyncFunction("dismissScanner")', 'dismissScanner'),
        ('Property("isModernBarcodeScannerAvailable")', 'isModernBarcodeScannerAvailable'),
        ('Prop("barcodeScannerSettings")', 'barcodeScannerSettings'),
        ('Prop("barcodeScannerEnabled")', 'barcodeScannerEnabled'),
    ]
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Remove MLKit imports
        if re.search(r'import.*(BarCodeScannerResultSerializer|MLKitBarCodeScanner|GmsBarcode|mlkit)', line, re.IGNORECASE):
            i += 1
            continue
        
        # Check if this line starts an MLKit function/property to remove
        should_remove = False
        for pattern, name in mlkit_removals:
            if pattern in line:
                should_remove = True
                start_line = i
                # Count brackets from this line
                brace_count = line.count('{') - line.count('}')
                i += 1
                
                # Continue until braces are balanced
                while i < len(lines) and brace_count > 0:
                    brace_count += lines[i].count('{') - lines[i].count('}')
                    i += 1
                
                # Include the closing brace line if brace_count is now 0
                # Skip trailing empty lines
                while i < len(lines) and lines[i].strip() == '':
                    i += 1
                break
        
        if should_remove:
            continue
        
        # Remove MLKit method calls completely
        mlkit_patterns = [
            'setBarcodeScannerSettings',
            'setShouldScanBarcodes', 
            'BarCodeScannerResultSerializer',
            'MLKitBarCodeScanner',
            'GmsBarcodeScannerOptions',
            'GmsBarcodeScanning',
            'mapToBarcode',
        ]
        
        skip_line = False
        for pattern in mlkit_patterns:
            if pattern in line and '//' not in line:
                skip_line = True
                break
        
        if skip_line:
            i += 1
            continue
        
        new_lines.append(line)
        i += 1
    
    content = '\n'.join(new_lines)
    
    # Add missing companion object with TAG if needed
    if needs_companion_object and 'class CameraViewModule' in content:
        lines = content.split('\n')
        brace_count = 0
        class_start = -1
        
        for i, line in enumerate(lines):
            if 'class CameraViewModule' in line:
                class_start = i
            if class_start >= 0:
                brace_count += line.count('{') - line.count('}')
                if brace_count == 0 and class_start < i:
                    indent = len(line) - len(line.lstrip())
                    companion = f'''
{indent * ' '}companion object {{
{indent * ' '}    private const val TAG = "CameraViewModule"
{indent * ' '}}}
'''
                    lines.insert(i, companion)
                    content = '\n'.join(lines)
                    break
    
    # Clean up multiple empty lines
    content = re.sub(r'\n\n\n+', '\n\n', content)
    
    write_file(file_path, content)


def fix_expo_camera_view(file_path: Path):
    """Fix ExpoCameraView.kt by removing MLKit code using bracket counting"""
    if not file_path.exists():
        return
    
    content = read_file(file_path)
    lines = content.split('\n')
    new_lines = []
    
    # Functions to remove - we know their starting patterns
    mlkit_functions = [
        ('fun setShouldScanBarcodes', 'setShouldScanBarcodes'),
        ('fun setBarcodeScannerSettings', 'setBarcodeScannerSettings'),
        ('private fun transformBarcodeScannerResultToViewCoordinates', 'transformBarcodeScannerResultToViewCoordinates'),
        ('private fun onBarcodeScanned', 'onBarcodeScanned'),
    ]
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Remove MLKit imports (but keep BarcodeType - it's not MLKit-specific)
        if re.search(r'import.*(BarcodeAnalyzer|mlkit)', line, re.IGNORECASE):
            if 'BarcodeType' not in line:
                i += 1
                continue
        
        # Remove BarcodeAnalyzer variable declarations
        if re.search(r'(var|val)\s+.*BarcodeAnalyzer', line, re.IGNORECASE):
            i += 1
            continue
        
        # Special handling for createImageAnalyzer - remove .also { analyzer -> } block
        if 'private fun createImageAnalyzer()' in line:
            # Keep the function declaration and everything up to .also
            new_lines.append(line)
            i += 1
            
            # Keep lines until we find .also { analyzer ->
            while i < len(lines):
                current_line = lines[i]
                
                # Check if this is the .also { analyzer -> line
                if re.search(r'\.also\s*\{\s*analyzer\s*->', current_line):
                    # Remove entire .also block - count braces from this line
                    brace_count = current_line.count('{') - current_line.count('}')
                    i += 1
                    
                    # Skip everything inside .also until braces are balanced
                    while i < len(lines) and brace_count > 0:
                        brace_count += lines[i].count('{') - lines[i].count('}')
                        i += 1
                    
                    # Skip trailing empty lines
                    while i < len(lines) and lines[i].strip() == '':
                        i += 1
                    break
                
                # Keep all lines before .also
                new_lines.append(current_line)
                i += 1
            continue
        
        # Check if this line starts an MLKit function to remove
        should_remove = False
        for pattern, name in mlkit_functions:
            if pattern in line:
                should_remove = True
                # Count brackets from this line
                brace_count = line.count('{') - line.count('}')
                i += 1
                
                # Continue until braces are balanced
                while i < len(lines) and brace_count > 0:
                    brace_count += lines[i].count('{') - lines[i].count('}')
                    i += 1
                
                # Skip trailing empty lines
                while i < len(lines) and lines[i].strip() == '':
                    i += 1
                break
        
        if should_remove:
            continue
        
        # Remove MLKit method calls
        mlkit_patterns = [
            'BarcodeAnalyzer(',
            'analyzer.setAnalyzer',
        ]
        
        skip_line = False
        for pattern in mlkit_patterns:
            if pattern in line and '//' not in line:
                skip_line = True
                break
        
        if skip_line:
            i += 1
            continue
        
        new_lines.append(line)
        i += 1
    
    content = '\n'.join(new_lines)
    
    # Remove empty .also { analyzer -> } blocks
    content = re.sub(
        r'\.also\s*\{\s*analyzer\s*->\s*\}\s*\n',
        '\n',
        content
    )
    
    # Clean up multiple empty lines
    content = re.sub(r'\n\n\n+', '\n\n', content)
    
    write_file(file_path, content)


def remove_mlkit_from_expo_camera(project_root: Path):
    """Remove ML Kit from expo-camera (for F-Droid compatibility)"""
    log("Removing MLKit from expo-camera...")
    camera_dir = project_root / "node_modules" / "expo-camera" / "android"
    
    if not camera_dir.exists():
        log("  Warning: expo-camera/android directory not found", Colors.YELLOW)
        return
    
    # Remove Google Play Services and MLKit dependencies from build.gradle
    build_gradle = camera_dir / "build.gradle"
    if build_gradle.exists():
        content = read_file(build_gradle)
        lines = content.split('\n')
        new_lines = []
        
        # Keywords that indicate Google Play Services / MLKit dependencies
        forbidden_keywords = [
            'play-services-code-scanner',
            'barcode-scanning',
            'camera--vision',
            'com.google.android.gms',
            'com.google.mlkit',
            'com.google.android.:',  # Catches the unusual pattern
            'com.google.:',  # Catches the unusual pattern
        ]
        
        for line in lines:
            # Check if line contains any forbidden keywords
            # Only remove if it looks like a dependency declaration
            should_skip = False
            line_stripped = line.strip()
            line_lower = line_stripped.lower()
            
            # Only process lines that look like dependencies
            is_dependency_line = any(line_lower.startswith(dep_type) for dep_type in 
                                   ['implementation', 'api', 'compileonly', 'runtimeonly', 'compile'])
            
            if is_dependency_line:
                for keyword in forbidden_keywords:
                    if keyword.lower() in line_lower:
                        should_skip = True
                        log(f"    Removed: {line_stripped[:80]}...", Colors.YELLOW)
                        break
            
            if not should_skip:
                new_lines.append(line)
        
        content = '\n'.join(new_lines)
        write_file(build_gradle, content)
        log("  Removed Google Play Services dependencies from build.gradle", Colors.GREEN)
    
    # Remove MLKit files and modify source code
    camera_src = camera_dir / "src" / "main" / "java" / "expo" / "modules" / "camera"
    if not camera_src.exists():
        log("  Warning: expo-camera source directory not found", Colors.YELLOW)
        return
    
    log("  Note: If build fails, you may need to restore node_modules/expo-camera first", Colors.YELLOW)
    
    # Remove MLKit analyzer files
    mlkit_files = [
        camera_src / "analyzers" / "BarcodeScannerResultSerializer.kt",
        camera_src / "analyzers" / "MLKitBarcodeAnalyzer.kt",
    ]
    
    for mlkit_file in mlkit_files:
        if mlkit_file.exists():
            mlkit_file.unlink()
            log(f"  Removed {mlkit_file.name}", Colors.GREEN)
    
    # Fix BarcodeAnalyzer.kt
    barcode_analyzer = camera_src / "analyzers" / "BarcodeAnalyzer.kt"
    if barcode_analyzer.exists():
        content = read_file(barcode_analyzer)
        lines = content.split('\n')
        new_lines = []
        in_mlkit_block = False
        brace_count = 0
        
        for i, line in enumerate(lines):
            # Remove MLKit imports (handle multiline imports)
            if re.search(r'import.*mlkit', line, re.IGNORECASE):
                continue
            
            # Remove @OptIn blocks
            if '@OptIn' in line:
                in_mlkit_block = True
                brace_count = line.count('{') - line.count('}')
                continue
            
            if in_mlkit_block:
                brace_count += line.count('{') - line.count('}')
                if brace_count <= 0:
                    in_mlkit_block = False
                continue
            
            # Remove MLKit-specific code completely
            mlkit_keywords = [
                'BarcodeScannerOptions',
                'BarcodeScanning',
                'InputImage',
                'barcodeFormats',
                'lensFacing',
                'rawValue',
                'rawBytes',
                'cornerPoints',
                'displayValue',
            ]
            
            skip_line = False
            for keyword in mlkit_keywords:
                if keyword in line and '//' not in line:
                    skip_line = True
                    break
            
            if skip_line:
                continue
            
            new_lines.append(line)
        
        content = '\n'.join(new_lines)
        
        # Remove @OptIn blocks more aggressively
        content = re.sub(r'@OptIn[^}]*\}', '', content, flags=re.DOTALL)
        
        write_file(barcode_analyzer, content)
    
    # Fix CameraRecords.kt
    # IMPORTANT: BarcodeType is NOT MLKit-specific - it's a record type needed for the API
    # We only remove MLKit-specific mapping functions, not the BarcodeType enum itself
    camera_records = camera_src / "records" / "CameraRecords.kt"
    if camera_records.exists():
        content = read_file(camera_records)
        lines = content.split('\n')
        new_lines = []
        in_map_function = False
        brace_count = 0
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Remove MLKit imports (but NOT BarcodeType - it's needed)
            if re.search(r'import.*mlkit', line, re.IGNORECASE):
                i += 1
                continue
            
            # Remove mapToBarcode function using indentation
            if 'fun' in line and 'mapToBarcode' in line:
                # Get indentation level
                func_indent = len(line) - len(line.lstrip())
                # Skip function declaration
                i += 1
                # Find closing brace at same or less indentation
                while i < len(lines):
                    current_line = lines[i]
                    current_indent = len(current_line) - len(current_line.lstrip())
                    if current_line.strip() == '}' and current_indent <= func_indent:
                        # Check if next line is "else" - if so, skip this brace
                        if i + 1 < len(lines):
                            next_line = lines[i + 1].strip()
                            if next_line.startswith('else'):
                                # This is "} else {" - not the function end, continue
                                i += 1
                                continue
                        i += 1  # Skip closing brace
                        break
                    # Stop if we hit another function/enum/class at same or less indentation
                    if (current_indent <= func_indent and current_line.strip() and
                        re.match(r'^\s*(fun |enum |class |companion object)', current_line)):
                        break
                    i += 1
                # Skip trailing empty lines
                while i < len(lines) and lines[i].strip() == '':
                    i += 1
                continue
            
            # DO NOT remove BarcodeType enum - it's needed for the API
            # Remove MLKit-specific Barcode.FORMAT_* references completely
            if 'Barcode.FORMAT_' in line and '//' not in line:
                i += 1
                continue
            
            new_lines.append(line)
            i += 1
        
        # Add BarcodeType enum if it's missing (it should exist but might have been removed)
        content = '\n'.join(new_lines)
        if 'enum class BarcodeType' not in content and 'BarcodeType' in content:
            # Find where to insert it (before BarcodeSettings)
            lines = content.split('\n')
            new_lines = []
            inserted = False
            for i, line in enumerate(lines):
                if 'data class BarcodeSettings' in line and not inserted:
                    # Insert BarcodeType enum before BarcodeSettings
                    indent = len(line) - len(line.lstrip())
                    indent_str = indent * ' '
                    barcode_type_enum = f'''{indent_str}enum class BarcodeType(val value: String) : Enumerable {{
{indent_str}  AZTEC("aztec"),
{indent_str}  EAN13("ean13"),
{indent_str}  EAN8("ean8"),
{indent_str}  QR("qr"),
{indent_str}  PDF417("pdf417"),
{indent_str}  UPCE("upce"),
{indent_str}  DATAMATRIX("datamatrix"),
{indent_str}  CODE39("code39"),
{indent_str}  CODE93("code93"),
{indent_str}  ITF14("itf14"),
{indent_str}  CODABAR("codabar"),
{indent_str}  CODE128("code128"),
{indent_str}  UPCA("upca"),
{indent_str}  UNKNOWN("unknown")
{indent_str}}}

'''
                    new_lines.append(barcode_type_enum)
                    inserted = True
                new_lines.append(line)
            content = '\n'.join(new_lines)
        
        write_file(camera_records, content)
    
    # Fix CameraViewModule.kt
    camera_view_module = camera_src / "CameraViewModule.kt"
    if camera_view_module.exists():
        fix_camera_view_module(camera_view_module)
    
    # Fix ExpoCameraView.kt
    expo_camera_view = camera_src / "ExpoCameraView.kt"
    if expo_camera_view.exists():
        fix_expo_camera_view(expo_camera_view)


def add_google_play_services_exclusions(project_root: Path):
    """Add global exclusions for Google Play Services"""
    log("Adding Google Play Services exclusions...")
    app_build_gradle = project_root / "android" / "app" / "build.gradle"
    
    if not app_build_gradle.exists():
        log(f"Warning: {app_build_gradle} not found", Colors.YELLOW)
        return
    
    if file_contains(app_build_gradle, 'configurations.all { exclude group: "com.google.android.gms"'):
        return
    
    content = read_file(app_build_gradle)
    
    # Add packaging options if not present
    if 'packagingOptions' not in content:
        content = re.sub(
            r'(android \{)',
            r'''\1
    packagingOptions {
        exclude '**/com/google/android/gms/**'
    }''',
            content
        )
    
    # Add dependency exclusions
    if 'dependencies {' in content:
        exclusion_block = '''
    configurations.all {
        exclude group: "com.google.android.gms"
        exclude group: "com.google.firebase"
        exclude group: "com.google.mlkit"
    }'''
        content = re.sub(
            r'(dependencies \{)',
            r'\1' + exclusion_block,
            content
        )
    
    write_file(app_build_gradle, content)


def cleanup(project_root: Path):
    """Clean up temporary files and directories"""
    log("Cleaning up...")
    
    # Remove local maven repos
    node_modules = project_root / "node_modules"
    if node_modules.exists():
        for local_repo in node_modules.glob("*/local-maven-repo"):
            if local_repo.is_dir():
                shutil.rmtree(local_repo, ignore_errors=True)
    
    # Remove fdroid-deps
    fdroid_deps = project_root / "fdroid-deps"
    if fdroid_deps.exists():
        shutil.rmtree(fdroid_deps, ignore_errors=True)


def main():
    """Main function"""
    log("🔧 Applying F-Droid fixes...", Colors.BLUE)
    log("=" * 50)
    
    # Get project root (script is in scripts/ directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    if not (project_root / "android").exists():
        log("Error: android directory not found! Are you in the project root?", Colors.RED)
        sys.exit(1)
    
    try:
        fix_expo_version_catalog(project_root)
        add_expo_modules_to_settings(project_root)
        replace_expo_module_dependencies(project_root)
        add_dependency_substitution(project_root)
        fix_fresco_version(project_root)
        fix_expo_autolinking(project_root)
        remove_problematic_maven_repos(project_root)
        add_expo_maven_repo(project_root)
        fix_react_native_screens(project_root)
        remove_mlkit_from_react_native_camera(project_root)
        # expo-camera removed - using react-native-vision-camera with ZXing instead
        # remove_mlkit_from_expo_camera(project_root)
        add_google_play_services_exclusions(project_root)
        cleanup(project_root)
        
        log("\n✅ F-Droid fixes applied successfully!", Colors.GREEN)
        
    except Exception as e:
        log(f"\n❌ Error applying F-Droid fixes: {e}", Colors.RED)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

