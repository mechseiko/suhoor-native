# Building Suhoor Android App Bundle (.aab)

This guide shows you how to generate the Android App Bundle (.aab) file for the Suhoor app using EAS Build.

## Prerequisites

- Node.js installed
- Expo account (free at https://expo.dev)
- EAS CLI installed globally

## Quick Start Steps

### 1. Install EAS CLI (if not already installed)
```bash
npm install -g eas-cli
```

### 2. Login to EAS
```bash
eas login
```
This will open a browser window for authentication.

### 3. Trigger Android Production Build
```bash
eas build --platform android --profile production
```

This will:
- Upload your project to Expo's cloud build servers
- Compile the Android app bundle (.aab)
- Generate a download link for the built file

## Build Configuration

The build configuration is stored in `eas.json`:
- **Profile:** `production`
- **Output:** Android App Bundle (.aab)
- **Package:** `com.mechseiko.suhoor`

## Project Files Excluded from Build

The `.easignore` file excludes unnecessary files to reduce upload size:
- `node_modules/` (not needed for cloud build)
- `ios/` directory (Android build only)
- Local build artifacts
- Development files
- Test files and documentation

## What Happens During Build

1. **Upload:** Project files are compressed and uploaded to EAS servers
2. **Build:** Expo compiles the app using their cloud infrastructure
3. **Sign:** The app is signed with your generated keystore
4. **Output:** You receive a download link for the .aab file

## Troubleshooting

### Build fails with authentication error
```bash
eas login
```

### Need to check build status
Visit your EAS project dashboard: https://expo.dev/accounts/mechseiko/projects/suhoor

### Build takes too long
- Check your internet connection
- Verify `.easignore` is properly configured to exclude large files

## Keystore Management

Your Android keystore is stored securely in EAS. You don't need to manage local keystore files.

## Alternative: Local Build (Not Recommended)

If you need to build locally (not recommended due to Android environment issues):
```bash
cd android
./gradlew bundleRelease
```

Note: Local builds may encounter Java/Gradle compatibility issues that EAS Build resolves automatically.

## Output Location

After successful EAS build, you'll receive:
- Direct download link for the .aab file
- Build ID for reference
- Build logs and status

The .aab file can be uploaded directly to Google Play Console for distribution.
