const fs = require('node:fs');
const path = require('node:path');

const gradlePath = path.resolve(__dirname, '../../android/app/build.gradle');
const applyLine = 'apply from: "./build-extra.gradle"\n';

const gradleContents = fs.readFileSync(gradlePath, 'utf8');

// Only add if it’s not already present
if (!gradleContents.startsWith(applyLine)) {
  // Prepend to the existing file
  fs.writeFileSync(gradlePath, applyLine + gradleContents);
  console.log('Applied build-extra.gradle to top of build.gradle!');
} else {
  console.log('build-extra.gradle already applied.');
}
