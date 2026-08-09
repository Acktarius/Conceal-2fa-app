# README4DEVS

Developer notes for local work, testing, and release builds (Android / F-Droid / iOS).

## Introduction

**Conceal Authenticator** is an Expo 54 / React Native app with custom native crypto (`react-native-conceal-crypto`), Nitro modules, and platform-specific release pipelines:

| Target | Mechanism |
|--------|-----------|
| Local dev | Expo dev client + Metro |
| Android (direct APK) | `./build-android.sh` + Gradle |
| F-Droid | Tag `*-f-droid` → GitHub Actions + reproducible APK |
| iOS | EAS Build (Expo account) + TestFlight submit |

Version numbers live in [`.env`](.env) (not committed with secrets — copy from team or use your own):

```bash
APP_VERSION=1.1.3
IOS_BUILD_NUMBER=8
ANDROID_VERSION_CODE=39
```

[`app.config.ts`](app.config.ts) reads these at prebuild time. Android signing secrets for **local** release builds go in [`.env_private`](.env_private) (see [hooks/android/3_signing.js](hooks/android/3_signing.js)).

**Prerequisites:** Node 20+, npm, Java 17, Android SDK 35 (for native Android builds), [EAS CLI](https://docs.expo.dev/build/setup/) logged into the Expo account (`owner: acktarius` in `app.config.ts`).

---

## Local build

### 1. Install dependencies

```bash
npm ci
```

### 2. Static checks and tests

```bash
npm run preflight          # types + lint + format + check
npm run test:unit          # Vitest (pure TS / crypto helpers)
npm run test:integration   # jest-expo App smoke test
npm run test               # both
```

### 3. Run on device / emulator (development)

**Option A — Expo dev client (recommended after a dev build is installed):**

```bash
npm run android            # expo run:android (debug dev client)
# In another terminal:
npx expo start --dev-client
```

**Option B — LAN dev (custom packager IP in `package.json` `dev` script):**

```bash
npm run dev
```

**Option C — iOS simulator / device (local Xcode toolchain):**

```bash
npm run ios                # expo run:ios
```

**Option D — Web (limited; not all native features work):**

```bash
npm run web
```

### 4. Regenerate native projects only

```bash
npx expo prebuild --platform android --clean
npx expo prebuild --platform ios --clean
```

The Android release script [`build-android.sh`](build-android.sh) wraps prebuild, Nitro hooks, and optional sign/unsign — prefer it for release-like Android trees.

---

## Prepare build for Android

### Version bump (all Android releases)

1. Edit [`.env`](.env):
   - `APP_VERSION` — user-visible version (e.g. `1.1.4`)
   - `ANDROID_VERSION_CODE` — **must increase** every release (integer, e.g. `40`)
2. Align [`package.json`](package.json) `"version"` with `APP_VERSION` if you publish npm-style tags.

### Direct APK release (GitHub Release, signed)

Used by [`.github/workflows/android-release.yml`](.github/workflows/android-release.yml) (manual **workflow_dispatch**) or locally:

```bash
# Regenerate android/ + hooks (interactive: sign = y for local keystore)
./build-android.sh y

cd android
./gradlew assembleRelease
```

APK output: `android/app/build/outputs/apk/release/ConcealAuthenticator-*.apk`

**CI:** GitHub → Actions → **Android Release Build** → Run workflow. It tags `v{APP_VERSION}` and uploads a draft release.

Local signing needs [`.env_private`](.env_private):

```bash
ANDROID_KEYSTORE_PATH=local-release-key.keystore
ANDROID_KEYSTORE_PASSWORD=...
ANDROID_KEY_ALIAS=...
ANDROID_KEY_PASSWORD=...
```

### ADB commands

Package name: `com.acktarius.concealauthenticator` (from [`app.config.ts`](app.config.ts)).

Uninstall before a clean reinstall:

```bash
adb uninstall com.acktarius.concealauthenticator
# or: adb uninstall <package_name>
```

When multiple devices/emulators are connected, pick one and pin Gradle/adb to it:

```bash
# List devices to get the ID
adb devices

# Set the device ID (use the ID from adb devices output)
export ANDROID_SERIAL=<device_id>

# Gradle installRelease uses ANDROID_SERIAL for the target device
cd android
./gradlew installRelease
```

### F-Droid release

F-Droid builds are triggered by a git tag matching `*-f-droid` (see [`.github/workflows/f-droid-release.yml`](.github/workflows/f-droid-release.yml)).

#### Pre-release checklist

- [ ] Bump `APP_VERSION` and `ANDROID_VERSION_CODE` in [`.env`](.env)
- [ ] Add changelog: [`fastlane/metadata/android/en-US/changelogs/{ANDROID_VERSION_CODE}.txt`](fastlane/metadata/android/en-US/changelogs/) (one file per version code, e.g. `40.txt`)
- [ ] Update store text if needed:
  - [ ] [`fastlane/metadata/android/en-US/title.txt`](fastlane/metadata/android/en-US/title.txt)
  - [ ] [`fastlane/metadata/android/en-US/short_description.txt`](fastlane/metadata/android/en-US/short_description.txt)
  - [ ] [`fastlane/metadata/android/en-US/full_description.txt`](fastlane/metadata/android/en-US/full_description.txt)
- [ ] Run FOSS compatibility scan (optional sanity check):

```bash
python3 scripts/check-fdroid-compatibility.py
```

- [ ] Commit version + fastlane metadata changes

#### Local F-Droid tree (matches CI intent)

```bash
# n = do not sign locally, y = unsign for F-Droid (repo-ready)
./build-android.sh n y

python3 scripts/fix-for-fdroid.py
# or: bash scripts/fix-for-fdroid.sh

cd android
./gradlew assembleRelease -x lintVitalAnalyzeRelease
```

#### Tag and push (triggers CI build + GitHub Release)

Use a tag name ending in `-f-droid`:

```bash
git tag v1.1.4-f-droid
git push origin v1.1.4-f-droid
```

Examples that match the workflow: `v1.1.4-f-droid`, `1.1.4-f-droid`.

CI will: `npm ci` → `./build-android.sh n n` → sign with GitHub secrets → `fix-for-fdroid.py` → reproducible APK normalization → publish release assets.

---

## Prepare build for iOS

Requires an **Expo (EAS) account** with access to project `b06dd25d-97c8-49c4-965e-d4f414bfbef3` ([`eas.json`](eas.json) / [`app.config.ts`](app.config.ts)).

Install CLI and log in:

```bash
npm install -g eas-cli
eas login
```

Bump iOS build metadata in [`.env`](.env):

```bash
APP_VERSION=1.1.3
IOS_BUILD_NUMBER=9          # increment for each App Store / TestFlight upload
```

Production iOS builds use **remote credentials** (`credentialsSource: remote`); EAS manages signing. `production` profile sets `autoIncrement: true` for App Store build numbers on EAS side — still keep `IOS_BUILD_NUMBER` in `.env` aligned for local prebuild consistency.

### Clean native iOS project

```bash
npx expo prebuild --platform ios --clean
```

### Build on EAS server (production → App Store / TestFlight)

```bash
eas build -p ios --profile production
```

### Build on EAS server (preview / internal debug-style release)

```bash
eas build -p ios --profile preview
```

### Build dev client (simulator, development profile)

```bash
eas build -p ios --profile development
```

### Test preview / dev client locally

After installing the built client on device or simulator:

```bash
npx expo start --dev-client
```

### Push to TestFlight

After a successful `production` build:

```bash
eas submit -p ios --latest
```

Or submit a specific build:

```bash
eas submit -p ios --id <build-id>
```

Apple Team ID is configured in [`eas.json`](eas.json) (`appleTeamId: U4D6B43275`).

---

## Quick reference

| Goal | Command |
|------|---------|
| Lint / types | `npm run preflight` |
| Unit tests | `npm run test:unit` |
| Android debug run | `npm run android` |
| Android release APK | `./build-android.sh y && cd android && ./gradlew assembleRelease` |
| F-Droid CI release | tag `vX.Y.Z-f-droid` and push |
| iOS cloud build | `eas build -p ios --profile production` |
| TestFlight | `eas submit -p ios --latest` |

## Related docs

- [docs/dependency-upgrades/expo-57-checklist.md](docs/dependency-upgrades/expo-57-checklist.md) — deferred Expo SDK upgrade
- [security/accepted-risks.md](security/accepted-risks.md) — known dependency audit exceptions
