# M4b Development Build Setup

## Overview

This document gives the exact commands to build the Deaf-user app with the
on-device TFLite model (M4b). The libraries below **do not run in Expo Go**
— the placeholder path (`EXPO_PUBLIC_USE_MODEL=false` or absent) is the only
way the app works in Expo Go and in the web build (localhost:8081).

## What was added

| Package | Role |
|---|---|
| `react-native-fast-tflite` | Load and run `.tflite` on-device |
| `react-native-nitro-modules` | Native module bridge (peer of fast-tflite) |
| `react-native-worklets-core` | Worklets for the camera frame processor |

## Files changed (mobile app only)

- `apps/mobile-deaf-user/package.json` — added `react-native-fast-tflite`,
  `react-native-nitro-modules`, `react-native-worklets-core` to devDependencies.
- `apps/mobile-deaf-user/metro.config.js` — added `tflite` (and `ntro`)
  to `assetExts` so Metro resolves the model bundle.
- `apps/mobile-deaf-user/src/config.ts` — added `USE_MODEL` flag:
  `true` = on-device model, `false`/absent = mock placeholder.
- `apps/mobile-deaf-user/src/model/*` — `preprocess.ts`,
  `recogniser.ts`, `assets.d.ts`, `useHandRecorder.ts`, `recogniser.test.ts`.

## Commands to run on Windows

```bat
:: 1. Install dependencies (run from repo root)
npm install

:: 2. Development build for Android (requires JDK 17+, Android SDK, ANDROID_HOME set)
cd apps\mobile-deaf-user
npx expo prebuild --clean --platform android
npx expo run:android

:: 3. Development build for iOS (requires Xcode 15+, CocoaPods)
npx expo prebuild --clean --platform ios
npx pod install
npx expo run:ios

:: 4. EAS development build (alternative, requires an EAS account and
//    `eas login`; your `eas.json` must have a `development` build profile)
npx eas build --platform android --profile development
npx eas build --platform ios --profile development

:: 5. Run the dev server (Expo Go does NOT have the native modules)
npx expo start        # or: npm start
```

## What to expect

- **Expo Go**: app runs, but `EXPO_PUBLIC_USE_MODEL` is `false` (or absent),
  so the recogniser falls back to the mock placeholder. `translation.ts`
  remains the mock translation seam.
- **Web build** (localhost:8081): `Platform.OS === \"web\"` so native libraries
  are never imported. The placeholder path runs unchanged.
- **Dev build (Android/iOS)**: `EXPO_PUBLIC_USE_MODEL=true` loads
  `react-native-fast-tflite`, reads `signova_model.tflite` from assets,
  runs the model, and feeds the top-5 into the existing Validate screen.

## Known limitations at this step

- `react-native-fast-tflite` and `react-native-vision-camera` v4 with the
  MediaPipe hand-landmarker frame processor are **native modules**: they
  cannot run in Expo Go. The web build has no native modules.
- The expo-vision-camera-v4-mediapipe plugin supports **Android only**;
  iOS is not currently supported in this plugin. The app keeps the existing
  camera path so the web build and Expo Go still work.
- The Model self-test screen is reachable only in development (`?dev=1`
  query param) — see `docs/model/MODEL_SELF_TEST.md` for the screen and
  fixtures flow. This screen is a **development-only debug tool**; it is not
  wired into the normal session state machine.
- Latency targets (500 ms): measure on a real device after the dev build
  passes. The self-test reports per-inference time, but the end-to-end
  latency (landmarks → model → top-5) must be measured on the device.

## Security notes

- Never commit `.env`, screenshots/, scripts/, tmp/, `_backup/`, or `.env`
  files. The TFLite model is tracked in git as binary asset
  (`apps/mobile-deaf-user/src/assets/model/signova_model.tflite`) — do not
  vendor it again.
- No server or web-app files are touched by this change.
