const fs = require('node:fs');
const path = require('node:path');

// Load version info
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const versionName = process.env.APP_VERSION || '1.0.0';
const versionCode = process.env.ANDROID_VERSION_CODE || '1';

// Renaming logic to insert
const gradleRenameLogic = `
    applicationVariants.all { variant ->
        variant.outputs.each { output ->
            def newName = "ConcealAuthenticator-${versionName}-${versionCode}.apk"
            if (output.outputFileName != null) {
                output.outputFileName = newName
            } else if (outputFileName != null) {
                outputFileName.set(newName)
            }
        }
    }
`;

// Read build.gradle
const gradlePath = path.resolve(__dirname, '../../android/app/build.gradle');
let gradleText = fs.readFileSync(gradlePath, 'utf8');

// Inject rename logic just before the final closing `}` of the first android block
const androidBlockRegex = /android\s*{([\s\S]*?)(^\})/m;
if (gradleText.includes('android {')) {
    // Find where to inject: just before the final closing brace of the block
    gradleText = gradleText.replace(
        /(android\s*{)([\s\S]*?)(^\})/m,
        (match, openBlock, innerContent, closeBrace) =>
            `${openBlock}\n${innerContent}\n${gradleRenameLogic}\n${closeBrace}`
    );
    fs.writeFileSync(gradlePath, gradleText);
    console.log('APK renaming logic injected inside android { ... } block.');
} else {
    console.log('No android { ... } block found in build.gradle! You may need to check your file structure.');
}
