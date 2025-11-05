const fs = require('node:fs');
const path = require('node:path');

// Path to AndroidManifest.xml
const manifestPath = path.resolve(__dirname, '../../android/app/src/main/AndroidManifest.xml');

// Activity aliases to remove
const ALIASES_TO_REMOVE = [
  'com.acktarius.concealauthenticator.MainActivityvelvet',
  'com.acktarius.concealauthenticator.MainActivityorange',
  'com.acktarius.concealauthenticator.MainActivitylight',
  'com.acktarius.concealauthenticator.MainActivitydark',
];

console.log('🧹 Cleaning unwanted activity-aliases from AndroidManifest.xml...');

try {
  // Read the manifest
  let manifestContent = fs.readFileSync(manifestPath, 'utf8');
  
  // Remove each activity-alias block
  ALIASES_TO_REMOVE.forEach(aliasName => {
    // Match the entire activity-alias block for this alias
    const regex = new RegExp(
      `<activity-alias[^>]*android:name="${aliasName}"[^>]*>[\\s\\S]*?</activity-alias>\\s*`,
      'g'
    );
    
    const before = manifestContent;
    manifestContent = manifestContent.replace(regex, '');
    
    if (before !== manifestContent) {
      console.log(`   ✓ Removed activity-alias: ${aliasName}`);
    }
  });
  
  // Write back the cleaned manifest
  fs.writeFileSync(manifestPath, manifestContent, 'utf8');
  console.log('✅ AndroidManifest.xml cleaned successfully!');
  
} catch (error) {
  console.error('❌ Error cleaning AndroidManifest.xml:', error.message);
  process.exit(1);
}

