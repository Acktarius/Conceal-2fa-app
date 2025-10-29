const fs = require('node:fs');
const path = require('node:path');

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

const isCI = !!process.env.GITHUB_ACTIONS;

// For local secrets
let secrets = {};
if (!isCI && fs.existsSync(path.resolve(__dirname, '../../.env_private'))) {
  secrets = require('dotenv').parse(fs.readFileSync(path.resolve(__dirname, '../../.env_private')));
}

const storeFile = isCI ? process.env.ANDROID_KEYSTORE_PATH : secrets.ANDROID_KEYSTORE_PATH;
const storePassword = isCI ? process.env.ANDROID_KEYSTORE_PASSWORD : secrets.ANDROID_KEYSTORE_PASSWORD;
const keyAlias = isCI ? process.env.ANDROID_KEY_ALIAS : secrets.ANDROID_KEY_ALIAS;
const keyPassword = isCI ? process.env.ANDROID_KEY_PASSWORD : secrets.ANDROID_KEY_PASSWORD;

let gradleContent = fs.readFileSync(gradlePath, 'utf8');

// 1. Ensure buildTypes.release has signingConfig signingConfigs.release
// Find buildTypes block
const buildTypesBlock = findBlock(gradleContent, 'buildTypes {');
if (buildTypesBlock) {
  let buildTypes = gradleContent.slice(...buildTypesBlock);
  const releaseBlock = findBlock(buildTypes, 'release {');
  if (releaseBlock) {
    let release = buildTypes.slice(...releaseBlock);
    // Replace any signingConfig line inside release block
    release = release.replace(/signingConfig\s+\S+.*/g, 'signingConfig signingConfigs.release');
    // Put revised release block back in buildTypes
    buildTypes = buildTypes.slice(0, releaseBlock[0]) + release + buildTypes.slice(releaseBlock[1]);
    // Put revised buildTypes back in gradleContent
    gradleContent = gradleContent.slice(0, buildTypesBlock[0]) + buildTypes + gradleContent.slice(buildTypesBlock[1]);
  }
}

// 2. Update or append release {} in signingConfigs
gradleContent = gradleContent.replace(
  /(signingConfigs\s*\{[\s\S]*?)(debug\s*\{[\s\S]*?\})([\s\S]*?\})/m,
  (match, prefix, debugBlock, after) => {
    // Remove any old release block in after
    after = after.replace(/release\s*\{[\s\S]*?\}/m, '');
    const releaseConfig = `
        release {
            storeFile file('${storeFile}')
            storePassword '${storePassword}'
            keyAlias '${keyAlias}'
            keyPassword '${keyPassword}'
        }
        `;
    return `${prefix}${debugBlock}${releaseConfig}\n}`;
  }
);

fs.writeFileSync(gradlePath, gradleContent);
console.log('Android release signing config updated in build.gradle.');
