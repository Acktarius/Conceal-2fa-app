#!/usr/bin/env python3
"""
F-Droid Compatibility Checker
Scans all node_modules packages to ensure they're FOSS-compatible
"""

import os
import json
import sys
from pathlib import Path
from typing import List, Tuple, Dict

# Colors for output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color

# FOSS-compatible licenses
FOSS_LICENSES = [
    "MIT", "Apache-2.0", "Apache-2", "Apache", "BSD-2-Clause", "BSD-3-Clause", "BSD",
    "ISC", "LGPL-2.1", "LGPL-3.0", "LGPL", "GPL-2.0", "GPL-3.0", "GPL",
    "MPL-2.0", "MPL", "CC0-1.0", "CC-BY-3.0", "CC-BY-4.0", "Unlicense",
    "WTFPL", "0BSD", "Artistic-2.0", "Public Domain", "BlueOak-1.0.0", "BlueOak"
]

# Known proprietary/problematic licenses
PROPRIETARY_LICENSES = [
    "Commercial", "Proprietary", "UNLICENSED", "SEE LICENSE IN"
]

# npm names that imply Google Play / analytics / crash reporting
PROBLEMATIC_PACKAGES = [
    "firebase", "google-analytics", "google-play-services", "gms",
    "crashlytics", "fabric", "mlkit", "play-services", "google-services",
]

# Gradle GMS/MLKit that fix-for-fdroid.py already strips. Anything else is a new issue.
# @see scripts/fix-for-fdroid.py
KNOWN_FDROID_STRIPPED_PACKAGES = {
    "react-native-vision-camera",
    "react-native-camera",
    "expo-camera",
}

# Deleted by build-android.sh before F-Droid assemble (dev-client GMS must not ship).
KNOWN_REMOVED_BEFORE_FDROID = {
    "expo-dev-client",
    "expo-dev-menu",
    "expo-dev-launcher",
}

GMS_GRADLE_MARKERS = (
    "com.google.android.gms",
    "com.google.mlkit",
    "com.google.firebase",
)

GRADLE_DEP_PREFIXES = (
    "implementation", "api", "compileonly",
    "runtimeonly", "compile", "kapt", "ksp", "annotationprocessor",
)


def is_foss_license(license_str: str) -> bool:
    """Check if license is FOSS-compatible"""
    if not license_str:
        return False
    
    license_upper = license_str.upper()
    # Normalize common variations
    license_normalized = license_upper.replace(" ", "-").replace("_", "-")
    
    # Check exact matches first (handles "Apache-2.0", "Apache 2.0", etc.)
    for foss in FOSS_LICENSES:
        foss_upper = foss.upper()
        # Exact match or contains the license name
        if foss_upper == license_normalized or foss_upper in license_normalized:
            return True
        # Also check without dashes/spaces
        if foss_upper.replace("-", "") in license_normalized.replace("-", ""):
            return True
    
    # Check for OR conditions (e.g., "(Unlicense OR Apache-2.0)")
    if " OR " in license_upper or " OR " in license_normalized:
        # Split by OR and check each part
        parts = license_upper.split(" OR ")
        for part in parts:
            part = part.strip().strip("()")
            if any(foss.upper() in part for foss in FOSS_LICENSES):
                return True
    
    return False


def is_proprietary_license(license_str: str) -> bool:
    """Check if license is proprietary"""
    if not license_str:
        return False
    
    license_upper = license_str.upper()
    return any(prop in license_upper for prop in PROPRIETARY_LICENSES)


def is_problematic_package(package_name: str) -> bool:
    """Check if package name contains problematic patterns"""
    package_lower = package_name.lower()
    return any(problematic in package_lower for problematic in PROBLEMATIC_PACKAGES)


def _gradle_package_name(gradle_path: Path, node_modules_path: Path) -> str:
    """Best-effort npm package name from a node_modules/.../android/*.gradle path."""
    try:
        rel = gradle_path.resolve().relative_to(node_modules_path.resolve())
    except ValueError:
        return gradle_path.parent.name
    parts = rel.parts
    if not parts:
        return gradle_path.parent.name
    if parts[0].startswith("@"):
        return f"{parts[0]}/{parts[1]}" if len(parts) > 1 else parts[0]
    return parts[0]


def scan_gradle_google_deps(project_root: Path) -> Tuple[List[str], List[str], int]:
    """Scan Gradle files for GMS/MLKit/Firebase dependency lines (skip build caches)."""
    issues: List[str] = []
    warnings: List[str] = []
    hit_count = 0
    node_modules_path = project_root / "node_modules"
    skip_parts = {"build", ".cxx", "intermediates", "lint-cache"}

    gradle_roots = [project_root / "android", node_modules_path]
    gradle_files = []
    for root in gradle_roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix not in {".gradle", ".kts"}:
                continue
            if any(part in skip_parts for part in path.parts):
                continue
            gradle_files.append(path)

    for gradle_path in gradle_files:
        try:
            text = gradle_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        pkg = _gradle_package_name(gradle_path, node_modules_path)
        rel = gradle_path.relative_to(project_root)
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith("//") or line.startswith("*"):
                continue
            lowered = line.lower().replace(" ", "")
            if not any(lowered.startswith(p) for p in GRADLE_DEP_PREFIXES):
                continue
            if not any(marker in line for marker in GMS_GRADLE_MARKERS):
                continue
            hit_count += 1
            msg = f"{pkg}: Google Play/MLKit/Firebase Gradle dep in {rel}: {line[:120]}"
            if pkg in KNOWN_REMOVED_BEFORE_FDROID:
                warnings.append(
                    msg + " (removed by build-android.sh before F-Droid assemble)"
                )
            elif pkg in KNOWN_FDROID_STRIPPED_PACKAGES:
                warnings.append(
                    msg + " (stripped by scripts/fix-for-fdroid.py before F-Droid assemble)"
                )
            else:
                issues.append(msg)

    return issues, warnings, hit_count


def extract_license(pkg_data: dict) -> str:
    """Extract license from package.json data"""
    # Try license field (can be string, object, or array)
    if "license" in pkg_data:
        license_val = pkg_data["license"]
        if isinstance(license_val, str):
            return license_val
        elif isinstance(license_val, dict) and "type" in license_val:
            return license_val["type"]
        elif isinstance(license_val, list):
            return ", ".join(str(l) for l in license_val)
    
    # Try licenses (plural) - old format
    if "licenses" in pkg_data and isinstance(pkg_data["licenses"], list):
        licenses = []
        for lic in pkg_data["licenses"]:
            if isinstance(lic, dict) and "type" in lic:
                licenses.append(lic["type"])
            else:
                licenses.append(str(lic))
        return ", ".join(licenses)
    
    return ""


def extract_repository(pkg_data: dict) -> str:
    """Extract repository URL from package.json data"""
    if "repository" in pkg_data:
        repo = pkg_data["repository"]
        if isinstance(repo, str):
            return repo
        elif isinstance(repo, dict) and "url" in repo:
            return repo["url"]
    
    return ""


def get_production_dependencies(project_root: Path) -> set:
    """Get set of production dependency package names"""
    deps = set()
    
    # Read package.json
    pkg_json_path = project_root / "package.json"
    if not pkg_json_path.exists():
        return deps
    
    try:
        with open(pkg_json_path, 'r', encoding='utf-8') as f:
            pkg_data = json.load(f)
        
        # Get production dependencies (not devDependencies)
        if "dependencies" in pkg_data:
            deps.update(pkg_data["dependencies"].keys())
        
        # Also try to get transitive deps using npm ls if available
        import subprocess
        try:
            result = subprocess.run(
                ["npm", "ls", "--production", "--json", "--depth=99"],
                cwd=project_root,
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0:
                npm_tree = json.loads(result.stdout)
                def extract_deps(tree, deps_set):
                    if "dependencies" in tree:
                        for dep_name in tree["dependencies"].keys():
                            deps_set.add(dep_name)
                            extract_deps(tree["dependencies"][dep_name], deps_set)
                extract_deps(npm_tree, deps)
        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
            # Fallback to just direct dependencies
            pass
    except (json.JSONDecodeError, KeyError):
        pass
    
    return deps


def is_test_fixture(pkg_name: str, pkg_path: Path) -> bool:
    """Check if package is a test fixture or dev-only package"""
    # Common test fixture names (these are typically test packages, not real dependencies)
    test_fixture_names = {
        "commonjs", "module", "esm", "browser", "bbb", "false_main",
        "browser_field", "baz", "invalid_main", "package", "dot_slash_main",
        "dot_main", "incorrect_main", "requireg", "test"
    }
    
    if pkg_name in test_fixture_names:
        return True
    
    # Check if package is in a test directory
    path_str = str(pkg_path)
    test_dirs = ["/test/", "/tests/", "/__tests__/", "/fixtures/", "/test-fixtures/", "/example/", "/Example/"]
    if any(test_dir in path_str for test_dir in test_dirs):
        return True
    
    return False


def is_npm_package_root(pkg_json: Path, node_modules_path: Path) -> bool:
    """Only scan the real package.json, not nested src/Example stubs."""
    try:
        rel = pkg_json.resolve().relative_to(node_modules_path.resolve())
    except ValueError:
        return False
    parts = rel.parts
    if parts[-1] != "package.json":
        return False
    if parts[0].startswith("@") and len(parts) == 3:
        return True
    if not parts[0].startswith("@") and len(parts) == 2:
        return True
    return False


def scan_packages(node_modules_path: Path, project_root: Path) -> Tuple[List[str], List[str], Dict[str, int]]:
    """Scan production packages in node_modules"""
    issues = []
    warnings = []
    stats = {
        "total": 0,
        "foss_compatible": 0,
        "no_license": 0,
        "proprietary_license": 0,
        "no_repo": 0,
        "problematic_deps": 0,
        "skipped": 0
    }
    
    if not node_modules_path.exists():
        print(f"{Colors.RED}❌ Error: node_modules directory not found!{Colors.NC}")
        print("   Run 'npm install' first.")
        sys.exit(1)
    
    # Get production dependencies
    print(f"{Colors.BLUE}Loading production dependencies...{Colors.NC}")
    prod_deps = get_production_dependencies(project_root)
    print(f"  Found {len(prod_deps)} production dependencies\n")
    
    print(f"{Colors.BLUE}Scanning node_modules (production only)...{Colors.NC}\n")
    
    # Find all package.json files
    package_files = []
    for root, dirs, files in os.walk(node_modules_path):
        # Skip nested node_modules beyond first level
        rel_path = Path(root).relative_to(node_modules_path)
        if len(rel_path.parts) > 1 and "node_modules" in str(rel_path):
            continue
        
        if "package.json" in files:
            cand = Path(root) / "package.json"
            if is_npm_package_root(cand, node_modules_path):
                package_files.append(cand)
    
    for pkg_json in package_files:
        # Get package name from directory
        pkg_name = pkg_json.parent.name
        pkg_path = pkg_json.parent
        
        # Skip test fixtures
        if is_test_fixture(pkg_name, pkg_path):
            stats["skipped"] += 1
            continue
        
        # Get actual package name from package.json (more reliable)
        try:
            with open(pkg_json, 'r', encoding='utf-8') as f:
                pkg_data = json.load(f)
            actual_pkg_name = pkg_data.get("name")
            
            # Skip if package.json doesn't have a proper "name" field (likely a test fixture)
            if not actual_pkg_name:
                stats["skipped"] += 1
                continue
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            # If we can't parse, skip it
            stats["skipped"] += 1
            continue
        
        # Only check if it's a production dependency (or transitive dep)
        # If prod_deps is empty (npm ls failed), check all non-test packages
        if prod_deps and actual_pkg_name not in prod_deps:
            # Check if it's a scoped package - try without scope
            if "/" in actual_pkg_name:
                scope, name = actual_pkg_name.split("/", 1)
                if name not in prod_deps:
                    stats["skipped"] += 1
                    continue
            else:
                stats["skipped"] += 1
                continue
        
        stats["total"] += 1
        
        # Extract license and repository
        license_str = extract_license(pkg_data)
        repo = extract_repository(pkg_data)
        
        has_issue = False
        
        # Check license
        if not license_str:
            stats["no_license"] += 1
            issues.append(f"{actual_pkg_name}: No license specified")
            has_issue = True
        elif is_proprietary_license(license_str):
            stats["proprietary_license"] += 1
            issues.append(f"{actual_pkg_name}: Proprietary license detected: {license_str}")
            has_issue = True
        elif not is_foss_license(license_str):
            warnings.append(f"{actual_pkg_name}: Unknown license '{license_str}' - verify manually")
        else:
            stats["foss_compatible"] += 1
        
        # Check repository
        if not repo:
            stats["no_repo"] += 1
            warnings.append(f"{actual_pkg_name}: No repository URL specified")
        
        # Check package name for problematic patterns
        if is_problematic_package(actual_pkg_name):
            stats["problematic_deps"] += 1
            issues.append(f"{actual_pkg_name}: Potentially problematic package (Google services, etc.)")
            has_issue = True
        
        # Progress indicator
        if stats["total"] % 50 == 0:
            print(f"\r  Scanned {stats['total']} packages (skipped {stats['skipped']})...", end="", flush=True)
    
    print(f"\r  Scanned {stats['total']} packages (skipped {stats['skipped']} test fixtures/dev deps)... Done!\n")
    return issues, warnings, stats


def main():
    """Main function"""
    print(f"{Colors.BLUE}🔍 F-Droid Compatibility Checker{Colors.NC}")
    print("=" * 50 + "\n")
    
    # Get project root (script is in scripts/ directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    node_modules_path = project_root / "node_modules"
    
    # Scan packages
    issues, warnings, stats = scan_packages(node_modules_path, project_root)

    print(f"{Colors.BLUE}Scanning Gradle files for Google Play / MLKit / Firebase...{Colors.NC}")
    gradle_issues, gradle_warnings, gradle_hits = scan_gradle_google_deps(project_root)
    issues.extend(gradle_issues)
    warnings.extend(gradle_warnings)
    stats["problematic_deps"] += len(gradle_issues)
    print(f"  Found {gradle_hits} matching Gradle dependency line(s)\n")
    
    # Print summary
    print(f"{Colors.BLUE}{'=' * 50}{Colors.NC}")
    print(f"{Colors.BLUE}📊 Summary{Colors.NC}")
    print(f"{Colors.BLUE}{'=' * 50}{Colors.NC}\n")
    
    print(f"Total packages scanned: {Colors.BLUE}{stats['total']}{Colors.NC}")
    if stats['skipped'] > 0:
        print(f"Packages skipped (test fixtures/dev deps): {Colors.YELLOW}{stats['skipped']}{Colors.NC}")
    print(f"FOSS-compatible: {Colors.GREEN}{stats['foss_compatible']}{Colors.NC}")
    print(f"Issues found: {Colors.RED}{len(issues)}{Colors.NC}\n")
    
    print("Breakdown:")
    print(f"  • No license: {Colors.YELLOW}{stats['no_license']}{Colors.NC}")
    print(f"  • Proprietary license: {Colors.RED}{stats['proprietary_license']}{Colors.NC}")
    print(f"  • No repository: {Colors.YELLOW}{stats['no_repo']}{Colors.NC}")
    print(f"  • Problematic packages: {Colors.RED}{stats['problematic_deps']}{Colors.NC}\n")
    
    # Print issues
    if issues:
        print(f"{Colors.RED}❌ Critical Issues (must fix for F-Droid):{Colors.NC}\n")
        for issue in issues:
            print(f"  {Colors.RED}•{Colors.NC} {issue}")
        print()
    
    # Print warnings (limit to 20)
    if warnings:
        print(f"{Colors.YELLOW}⚠️  Warnings (review manually):{Colors.NC}\n")
        for warning in warnings[:20]:
            print(f"  {Colors.YELLOW}•{Colors.NC} {warning}")
        if len(warnings) > 20:
            print(f"  {Colors.YELLOW}... and {len(warnings) - 20} more warnings{Colors.NC}")
        print()
    
    # Final verdict
    if not issues:
        print(f"{Colors.GREEN}✅ All packages appear F-Droid compatible!{Colors.NC}\n")
        sys.exit(0)
    else:
        print(f"{Colors.RED}❌ Found {len(issues)} package(s) with issues.{Colors.NC}")
        print(f"{Colors.YELLOW}   Review the issues above and fix them before submitting to F-Droid.{Colors.NC}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()

