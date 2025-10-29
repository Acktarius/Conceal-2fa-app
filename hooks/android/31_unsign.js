const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

function findBlock(str, blockStart) {
  const start = str.indexOf(blockStart);
  if (start === -1) return null;
  let open = 0,
    end = start;
  for (let i = start; i < str.length; i++) {
    if (str[i] === '{') open++;
    if (str[i] === '}') {
      open--;
      if (open === 0) {
        end = i;
        break;
      }
    }
  }
  return start !== -1 ? [start, end + 1] : null;
}

const gradlePath = path.resolve(__dirname, '../../android/app/build.gradle');

// Confirmation prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('\n⚠️  WARNING: This script will modify build.gradle so it is ready for F-Droid');
console.log('   It will remove signingConfig from buildTypes.release block.\n');

rl.question('Confirm | Exit (type "C" to proceed): ', (answer) => {
  rl.close();

  if (answer.toLowerCase() !== 'c' && answer.toLowerCase() !== 'confirm') {
    console.log('❌ Operation cancelled.');
    process.exit(0);
  }

  console.log('\n🔄 Processing build.gradle...');

  // Read the build.gradle file
  let gradleContent = fs.readFileSync(gradlePath, 'utf8');

  // Find buildTypes block
  const buildTypesBlock = findBlock(gradleContent, 'buildTypes {');
  if (buildTypesBlock) {
    let buildTypes = gradleContent.slice(...buildTypesBlock);
    const releaseBlock = findBlock(buildTypes, 'release {');
    
    if (releaseBlock) {
      let release = buildTypes.slice(...releaseBlock);
      
      // Remove signingConfig line(s) from release block
      const originalRelease = release;
      release = release.replace(/signingConfig\s+\S+.*/g, '');
      
      // Check if we actually removed something
      if (release !== originalRelease) {
        console.log('✅ Removed signingConfig from release block');
      } else {
        console.log('ℹ️  No signingConfig found in release block (already unsigned)');
      }
      
      // Add comment if release block is not empty
      if (release.trim().length > 10) { // More than just "release {\n}"
        // Check if comment already exists
        if (!release.includes('// No signingConfig here for F-Droid!')) {
          // Insert comment after the opening brace
          release = release.replace(/(release\s*\{)/, '$1\n        // No signingConfig here for F-Droid!');
        }
      }
      
      // Put revised release block back in buildTypes
      buildTypes = buildTypes.slice(0, releaseBlock[0]) + release + buildTypes.slice(releaseBlock[1]);
      // Put revised buildTypes back in gradleContent
      gradleContent = gradleContent.slice(0, buildTypesBlock[0]) + buildTypes + gradleContent.slice(buildTypesBlock[1]);
    } else {
      console.log('⚠️  Warning: release block not found in buildTypes');
    }
  } else {
    console.log('⚠️  Warning: buildTypes block not found in build.gradle');
  }

  // Write the modified content back
  fs.writeFileSync(gradlePath, gradleContent);
  
  console.log('\n✅ Success! Modification completed.');
  console.log('📝 Now you have to commit and push with a vx.y.z-f-droid tag \n\tto trigger a f-droid ready release\n');
});
