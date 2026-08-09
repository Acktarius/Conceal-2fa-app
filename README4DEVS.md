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

**Prerequisites:** Node 20+, npm, Java 17, Android SDK 35 (for native Android builds), [EAS CLI](https://docs.expo.dev/build/setup/) logged into the Expo account (`owner: acktarius` in `app.config.ts`). Optional: **Docker** + **[act](https://nektos.github.io/act/)** to replay GitHub Actions locally (see [Local GitHub Actions (act)](#local-github-actions-act)).

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

## Local GitHub Actions (act)

Replay [`.github/workflows/ci-check.yml`](.github/workflows/ci-check.yml) and [`.github/workflows/security-check.yml`](.github/workflows/security-check.yml) in Docker **before push**, without waiting on GitHub runners.

| Tool | Role |
|------|------|
| **act** | Runs workflow YAML locally in Docker |
| **`gh workflow run`** | Triggers workflows on GitHub (remote only) |
| **`npm run lint` / `test:unit`** | Fastest day-to-day check; no Docker |

### What maps to what

| GitHub workflow | Jobs replayed locally | Command |
|-----------------|----------------------|---------|
| `ci-check.yml` | `check` — `npm ci`, lint, types, unit tests | `npm run ci:act` |
| `security-check.yml` | `npm-audit` — `npm audit --audit-level=critical` | `npm run ci:act:security` |
| `security-check.yml` | `secret-scan` — Gitleaks | `npm run ci:act:security` |
| `security-check.yml` | `dependency-review` | **skipped** (PR-only on GitHub) |

Repo files: [`.actrc`](.actrc) (runner image + arch), [`scripts/act-ci.sh`](scripts/act-ci.sh) (wrapper). Copy both to other Node projects and edit workflow paths in the script if needed.

### One-time setup

**1. Docker** — daemon running (`docker info` succeeds).

**2. act** — install binary:

```bash
curl -fsSL https://raw.githubusercontent.com/nektos/act/master/install.sh | bash -s -- -b ~/.local/bin
```

**3. Shell** — append to `~/.bashrc`, then `source ~/.bashrc`:

```bash
# --- act: local GitHub Actions (nektos/act) ---
export PATH="$HOME/.local/bin:$PATH"
# Event act simulates (push | pull_request); scripts/act-ci.sh defaults to push
export ACT_EVENT="${ACT_EVENT:-push}"
# Optional: for security-check gitleaks job; use gh token if logged in:
# export ACT_GITHUB_TOKEN="$(gh auth token 2>/dev/null)"
```

**4. First run** — pulls Docker image `catthehacker/ubuntu:act-latest` (~500MB once). Inside the container, `setup-node@v7` installs Node **24** (same as CI).

### Commands

```bash
npm run ci:act              # ci-check.yml
npm run ci:act:security     # security-check (npm-audit + gitleaks)
npm run ci:act:all          # both

scripts/act-ci.sh           # same as ci:act
scripts/act-ci.sh dry-run   # list steps, no execution
scripts/act-ci.sh list      # list jobs act would run
scripts/act-ci.sh help
```

Pass extra args through to `act` (e.g. verbose):

```bash
scripts/act-ci.sh ci -v
```

Simulate a PR event (only matters for workflows with `pull_request` filters):

```bash
ACT_EVENT=pull_request scripts/act-ci.sh ci
```

### Faster check without Docker

Use this for routine edits; use `act` before merge when you want parity with CI:

```bash
npm ci && npm run lint && npm run types && npm run test:unit
npm audit --audit-level=critical
```

### Security (host isolation)

`scripts/act-ci.sh` is configured to **avoid extra host exposure**:

| Measure | What it does |
|---------|----------------|
| **No `--bind`** | Repo is **copied** into the container, not bind-mounted from your disk (container writes do not sync back to your tree). |
| **No extra `-v` mounts** | Script rejects `--bind`, `-v`, `--volume`, `--mount` passthrough args. |
| **No auto `.env` / `.secrets`** | `--env-file /dev/null` and `--secret-file /dev/null` so act does not inject local env files (including `.env_private` patterns). |
| **No `--privileged`** | Standard unprivileged container. |
| **`--rm`** | Container removed after the run. |
| **Pinned image digest** | [`.actrc`](.actrc) pins `catthehacker/ubuntu:act-latest@sha256:…` for reproducible pulls. |

**Still required (normal Docker/act behavior):**

- Docker daemon socket access (act must talk to Docker).
- Default **`network=host`** (act default) — job can reach services on `localhost`. For tighter isolation: `ACT_NETWORK=bridge npm run ci:act` (may affect action cache; try if you run local DBs on 127.0.0.1).
- **`npm ci` postinstall scripts** run **inside** the container — same trust as CI; not host-as-root.

**Do not** pass `scripts/act-ci.sh ci --bind` or custom volume flags. Use plain `npm run ci:act`.

### Caveats

- **`dependency-review`** needs GitHub’s PR API — not replayed by `act`.
- **Gitleaks job** may warn without a token; set `ACT_GITHUB_TOKEN` (see bashrc) or use a dummy value for local scans.
- **Runtime:** first `ci:act` ~1–2 min (`npm ci` in container); later runs use Docker/npm caches.
- **`gh`** does not run workflows locally — only `act` or the npm commands above do.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `act not found` | Install act; ensure `~/.local/bin` is on `PATH` |
| `Docker is not running` | Start Docker Desktop / `sudo systemctl start docker` |
| act prompts for image size | Repo [`.actrc`](.actrc) should prevent that; run from repo root |
| Vitest `kill EACCES` in Cursor sandbox | Run `npm run test:unit` in your own terminal, not the agent sandbox |

---

## Quick reference

| Goal | Command |
|------|---------|
| CI workflow (act) | `npm run ci:act` |
| Security workflow (act) | `npm run ci:act:security` |
| CI + security (act) | `npm run ci:act:all` |
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
