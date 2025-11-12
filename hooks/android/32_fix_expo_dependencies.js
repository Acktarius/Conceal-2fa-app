const fs = require('node:fs');
const path = require('node:path');

console.log('\n🔄 Fixing Expo module dependencies for F-Droid build...');

const androidDir = path.resolve(__dirname, '../../android');
const settingsGradlePath = path.join(androidDir, 'settings.gradle');

// Map of Maven coordinates to project names
// Format: { group:artifact:version -> projectName }
const expoModuleMap = {
  'expo.modules.asset': 'expo-asset',
  'expo.modules.camera': 'expo-camera',
  'expo.modules.clipboard': 'expo-clipboard',
  'expo.modules.constants': 'expo-constants',
  'expo.modules.crypto': 'expo-crypto',
  'expo.modules.securestore': 'expo-secure-store',
  'expo.modules.localauthentication': 'expo-local-authentication',
  'expo.modules.font': 'expo-font',
  'expo.modules.splashscreen': 'expo-splash-screen',
  'expo.modules.statusbar': 'expo-status-bar',
  'expo.modules.devicemenu': 'expo-dev-menu',
  'expo.modules.devicelauncher': 'expo-dev-launcher',
  'expo.modules.devclient': 'expo-dev-client',
  'expo.modules.filesystem': 'expo-file-system',
  'expo.modules.jsonutils': 'expo-json-utils',
  'expo.modules.keepawake': 'expo-keep-awake',
  'expo.modules.manifests': 'expo-manifests',
  'expo.modules.updatesinterface': 'expo-updates-interface',
};

// Also handle host.exp.exponent group
const hostExpoModuleMap = {
  'expo.modules.asset': 'expo-asset',
  'expo.modules.camera': 'expo-camera',
  'expo.modules.clipboard': 'expo-clipboard',
  'expo.modules.constants': 'expo-constants',
  'expo.modules.crypto': 'expo-crypto',
  'expo.modules.securestore': 'expo-secure-store',
  'expo.modules.localauthentication': 'expo-local-authentication',
  'expo.modules.font': 'expo-font',
  'expo.modules.splashscreen': 'expo-splash-screen',
  'expo.modules.statusbar': 'expo-status-bar',
};

function findBuildGradleFiles(dir) {
  const files = [];
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules and build directories
        if (!entry.name.includes('node_modules') && entry.name !== 'build') {
          walk(fullPath);
        }
      } else if (entry.name === 'build.gradle' || entry.name === 'build.gradle.kts') {
        files.push(fullPath);
      }
    }
  }
  walk(dir);
  return files;
}

function getProjectNameFromMavenCoord(group, artifact) {
  // Handle expo.modules.* group
  if (group === 'expo.modules.asset' || group.startsWith('expo.modules.')) {
    if (artifact === group || artifact.startsWith('expo.modules.')) {
      // Extract module name: expo.modules.asset -> asset
      const moduleKey = group.replace('expo.modules.', '');
      return expoModuleMap[group] || expoModuleMap[`expo.modules.${moduleKey}`];
    }
  }
  
  // Handle host.exp.exponent group
  if (group === 'host.exp.exponent') {
    if (artifact.startsWith('expo.modules.')) {
      const moduleKey = artifact.replace('expo.modules.', '');
      return hostExpoModuleMap[`expo.modules.${moduleKey}`];
    }
  }
  
  return null;
}

function replaceMavenDependencies(content) {
  let modified = content;
  let replacements = 0;

  // Pattern 1: implementation("expo.modules.asset:expo.modules.asset:12.0.9")
  // Pattern 2: implementation "host.exp.exponent:expo.modules.clipboard:8.0.7"
  // Pattern 3: implementation('expo.modules.asset:expo.modules.asset:12.0.9')
  const patterns = [
    // With parentheses and double quotes
    /(implementation|api|compileOnly|runtimeOnly)\s*\(\s*["']([^"']+):([^"']+):([^"']+)["']\s*\)/g,
    // With parentheses and single quotes
    /(implementation|api|compileOnly|runtimeOnly)\s*\(\s*['"]([^'"]+):([^'"]+):([^'"]+)['"]\s*\)/g,
    // Without parentheses, with double quotes
    /(implementation|api|compileOnly|runtimeOnly)\s+["']([^"']+):([^"']+):([^"']+)["']/g,
    // Without parentheses, with single quotes
    /(implementation|api|compileOnly|runtimeOnly)\s+['"]([^'"]+):([^'"]+):([^'"]+)['"]/g,
  ];
  
  for (const pattern of patterns) {
    modified = modified.replace(pattern, (match, depType, group, artifact, version) => {
      const projectName = getProjectNameFromMavenCoord(group, artifact);
      
      if (projectName) {
        replacements++;
        console.log(`  ✅ Replacing ${group}:${artifact}:${version} with project(":${projectName}")`);
        // Always use parentheses for consistency
        return `${depType}(project(":${projectName}"))`;
      }
      
      return match;
    });
  }

  return { content: modified, replacements };
}

// Step 1: Disable Expo version catalog which uses Maven coordinates
if (fs.existsSync(settingsGradlePath)) {
  console.log(`\n📝 Processing: settings.gradle`);
  let settingsContent = fs.readFileSync(settingsGradlePath, 'utf8');
  const originalSettings = settingsContent;
  
  // Comment out useExpoVersionCatalog() which generates Maven dependencies
  if (settingsContent.includes('expoAutolinking.useExpoVersionCatalog()')) {
    settingsContent = settingsContent.replace(
      /expoAutolinking\.useExpoVersionCatalog\(\)/g,
      '// expoAutolinking.useExpoVersionCatalog() // Disabled for F-Droid to use project() references instead of Maven'
    );
    console.log(`  ✅ Disabled expoAutolinking.useExpoVersionCatalog() to force project() references`);
  }
  
  if (settingsContent !== originalSettings) {
    fs.writeFileSync(settingsGradlePath, settingsContent, 'utf8');
  }
}

// Step 2: Find and fix Maven dependencies in build.gradle files
const buildGradleFiles = findBuildGradleFiles(androidDir);

if (buildGradleFiles.length === 0) {
  console.log('⚠️  No build.gradle files found in android directory');
} else {
  console.log(`\n📁 Found ${buildGradleFiles.length} build.gradle file(s)`);
  
  let totalReplacements = 0;
  
  for (const filePath of buildGradleFiles) {
    console.log(`\n📝 Processing: ${path.relative(androidDir, filePath)}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    const result = replaceMavenDependencies(content);
    
    if (result.replacements > 0) {
      fs.writeFileSync(filePath, result.content, 'utf8');
      totalReplacements += result.replacements;
      console.log(`  ✅ Made ${result.replacements} replacement(s)`);
    } else {
      console.log(`  ℹ️  No Maven-style Expo dependencies found`);
    }
  }
  
  if (totalReplacements > 0) {
    console.log(`\n✅ Fixed ${totalReplacements} Expo module dependency(ies) in build.gradle files.`);
  }
}

// Step 3: Check app/build.gradle for expoLibs usage and replace with direct dependencies
const appBuildGradlePath = path.join(androidDir, 'app', 'build.gradle');
if (fs.existsSync(appBuildGradlePath)) {
  console.log(`\n📝 Checking app/build.gradle for expoLibs usage...`);
  let appContent = fs.readFileSync(appBuildGradlePath, 'utf8');
  const originalApp = appContent;
  
  // Try to find the actual version from version catalog or use fallback
  let expoLibVersions = {
    'fresco': '3.1.3', // Fallback version
  };
  
  // Try to read version from gradle/libs.versions.toml if it exists
  const libsVersionsPath = path.join(androidDir, 'gradle', 'libs.versions.toml');
  if (fs.existsSync(libsVersionsPath)) {
    const tomlContent = fs.readFileSync(libsVersionsPath, 'utf8');
    const frescoMatch = tomlContent.match(/fresco\s*=\s*["']([^"']+)["']/i);
    if (frescoMatch) {
      expoLibVersions.fresco = frescoMatch[1];
      console.log(`  ℹ️  Found fresco version ${frescoMatch[1]} from libs.versions.toml`);
    }
  }
  
  // Also check expo-modules-core for version
  const expoModulesCorePath = path.join(androidDir, '..', 'node_modules', 'expo-modules-core', 'android', 'build.gradle');
  if (fs.existsSync(expoModulesCorePath)) {
    const coreContent = fs.readFileSync(expoModulesCorePath, 'utf8');
    const frescoVersionMatch = coreContent.match(/fresco[^:]*:\s*["']([^"']+)["']/i);
    if (frescoVersionMatch && !expoLibVersions.fresco) {
      expoLibVersions.fresco = frescoVersionMatch[1];
      console.log(`  ℹ️  Found fresco version ${frescoVersionMatch[1]} from expo-modules-core`);
    }
  }
  
  let replacements = 0;
  
  // Pattern 1: ${expoLibs.versions.fresco.get()} - inside string interpolation
  appContent = appContent.replace(/\$\{expoLibs\.versions\.(\w+)\.get\(\)\}/g, (match, libName) => {
    if (expoLibVersions[libName]) {
      replacements++;
      console.log(`  ✅ Replacing ${match} with "${expoLibVersions[libName]}"`);
      return expoLibVersions[libName]; // No quotes in string interpolation
    }
    console.log(`  ⚠️  Unknown expoLibs version: ${libName}, keeping original`);
    return match;
  });
  
  // Pattern 2: expoLibs.versions.fresco.get() - standalone
  const expoLibsPattern = /expoLibs\.versions\.(\w+)\.get\(\)/g;
  appContent = appContent.replace(expoLibsPattern, (match, libName) => {
    if (expoLibVersions[libName]) {
      replacements++;
      console.log(`  ✅ Replacing expoLibs.versions.${libName}.get() with "${expoLibVersions[libName]}"`);
      return `"${expoLibVersions[libName]}"`; // With quotes for direct replacement
    }
    console.log(`  ⚠️  Unknown expoLibs version: ${libName}, keeping original`);
    return match;
  });
  
  if (appContent !== originalApp) {
    fs.writeFileSync(appBuildGradlePath, appContent, 'utf8');
    console.log(`  ✅ Updated app/build.gradle with ${replacements} replacement(s)`);
  } else {
    console.log(`  ℹ️  No expoLibs usage found (good - using autolinking)`);
  }
}

// Step 4: Verify that Expo modules are included in settings.gradle
if (fs.existsSync(settingsGradlePath)) {
  console.log(`\n📝 Verifying Expo module includes in settings.gradle...`);
  const settingsContent = fs.readFileSync(settingsGradlePath, 'utf8');
  
  // Check for expo module includes
  const expoIncludes = settingsContent.match(/include\([^)]*expo[^)]*\)/g) || [];
  const expoProjects = settingsContent.match(/project\([^)]*expo[^)]*\)/g) || [];
  
  if (expoIncludes.length > 0 || expoProjects.length > 0) {
    console.log(`  ✅ Found ${expoIncludes.length} expo include(s) and ${expoProjects.length} expo project reference(s)`);
    expoIncludes.forEach(inc => console.log(`     - ${inc}`));
  } else {
    console.log(`  ℹ️  No explicit expo includes found (autolinking handles this dynamically)`);
  }
}

// Step 5: Verify app/build.gradle uses project references
if (fs.existsSync(appBuildGradlePath)) {
  console.log(`\n📝 Verifying project() references in app/build.gradle...`);
  const appContent = fs.readFileSync(appBuildGradlePath, 'utf8');
  
  const projectRefs = appContent.match(/project\([^)]*expo[^)]*\)/g) || [];
  if (projectRefs.length > 0) {
    console.log(`  ✅ Found ${projectRefs.length} project() reference(s) to expo modules`);
    projectRefs.forEach(ref => console.log(`     - ${ref}`));
  } else {
    console.log(`  ℹ️  No explicit project() references found (autolinking handles this via autolinkLibrariesWithApp())`);
  }
}

console.log(`\n✅ Success! Expo autolinking configured to use project() references instead of Maven coordinates.`);
console.log(`   Note: Expo autolinking adds includes and dependencies dynamically at build time.`);
console.log(`   With useExpoVersionCatalog() disabled, it will use project() references instead of Maven coordinates.`);

