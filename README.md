# My Budget — React Native + Expo

The cross-platform app lives on `main`. The earlier Kotlin prototype is preserved on `master` at `ce65363`.

## Current checkpoint

A five-tab TypeScript budget preview with light/dark appearance, monthly sample data, an expense pie chart, compact budget cards, and Expo development-client support. The local SQLite foundation initializes on startup. Screens still use labeled sample data; entry forms are the next milestone. Android is the first implementation/test target; iOS validation comes after the Android application is complete.

The application identifier is `com.zaina.budgetapp`, so this app can coexist with the Kotlin prototype (`com.example.mybudgetapp`).

## Local setup on Windows

1. Install Node.js LTS with npm, JDK 17, and Android Studio.
2. Set `JAVA_HOME` to JDK 17 and `ANDROID_HOME` to your Android SDK directory. By default the SDK is under `%LOCALAPPDATA%\Android\Sdk`.
3. Open a fresh PowerShell terminal in this repository.
4. Run `npm.cmd ci` to install the versions recorded in `package-lock.json`.
5. Run `npm.cmd run typecheck` to check TypeScript.
6. Run `npm.cmd run build:android` to generate the native Android project and build an ARM64 development APK without a phone connected.

The build may download additional Android components the first time. Follow any reported SDK/license setup instructions. Generated `android/` and `ios/` directories are ignored; keep native configuration in `app.json` and Expo config plugins.

Expected APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

## When your phone is connected

Unlock the phone and authorize USB debugging. Run `npm.cmd run android` to build/install and start development. Alternatively install the APK with Android's `adb install -r`, use `adb reverse tcp:8081 tcp:8081` for the USB connection to Metro, and run `npm.cmd start`.

This first APK is a development build, which uses Metro on your computer to load the JavaScript. A later standalone build will bundle the code for independent offline use. Metro is a development server, not a backend for financial records. No Expo account or EAS cloud build is required for this local Android workflow.

## Learn the files

| File | Purpose |
| --- | --- |
| `index.ts` | Registers the root React component with Expo. |
| `App.tsx` | Shared state, tab navigation, theme providers, and expense preview modal. |
| `app.json` | App name, identifiers, appearance, icons, and native configuration. |
| `package.json` | Dependencies and development commands. |
| `package-lock.json` | Reproducible dependency versions. |
| `tsconfig.json` | TypeScript's compile-time checking rules. |
| `scripts/build-android.ps1` | Local Android generation/build command without requiring a phone. |

`View` arranges content; `Text` displays text; `ScrollView` allows scrolling. `StyleSheet.create` groups layout and appearance rules. `useColorScheme` reads the system's light/dark choice. `SafeAreaView` keeps content clear of system bars. Components are functions that return UI, similar in purpose to the composable functions in the Kotlin prototype.

## Next milestones

1. Starter installed and confirmed visible on OnePlus 8T.
2. Five-tab design preview implemented; see Lesson 2.
3. SQLite schema, startup initialization, repository and tested financial rules implemented. Device startup verification pending reconnection.
4. Implement accounts/cards, categories, income, expenses, transfers, and credit-card repayments without double counting.
5. Add monthly budgets, copying past plans, and a dashboard driven by stored records.
6. Add manual backup/restore, migration tests, and standalone Android release checks.
7. Test and adapt on iOS only after Android is complete.

A Mac and Xcode are needed for local iOS native builds; optional cloud builds are an alternative. iOS compilation, signing, and device behavior remain unverified.

## Verification (2026-09-29)

- TypeScript strict checking passed.
- Expo dependency compatibility check passed.
- Expo Doctor: 21/21 checks passed.
- Metro successfully exported the Android JavaScript bundle.
- Installed on the OnePlus 8T on 2026-09-29. The owner confirmed the starter screen was visible. Metro and USB forwarding are configured.
- npm reported 10 moderate advisories in the Expo tooling dependency chain. The suggested forced fix downgrades Expo to SDK 46; it was not applied. Review compatible upstream updates before release.
- Native Android debug build succeeded (first run: 36m 43s, including native setup/downloads).
- APK metadata verified: com.zaina.budgetapp, version 1.0.0, ARM64, minimum API 24, target API 36.
- APK location: android/app/build/outputs/apk/debug/app-debug.apk (approximately 61 MiB).

## Beginner walkthrough

Read [Lesson 1: the Expo starter explained](docs/01-expo-starter-explained.md) for a detailed explanation of the setup, code, build process, USB testing, and daily commands.

Read [Lesson 2: navigation and screens](docs/02-navigation-and-screens.md) for state, props, reusable components, chart calculations, and phone checks.

Read [Lesson 3: local storage and financial rules](docs/03-local-storage-and-financial-rules.md) for the database schema, migrations, exact money handling, and transfer/credit rules.
