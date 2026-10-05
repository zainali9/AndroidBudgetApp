# My Budget — React Native + Expo

The cross-platform app lives on `main`. The earlier Kotlin prototype is preserved on `master` at `ce65363`.

## Current checkpoint

A five-tab TypeScript budget app with local SQLite records, account/category setup, income and expense entry, transfers, an expense pie chart, and light/dark appearance. Screens now show saved records. Monthly budget limits, copying past plans into drafts, and category name/parent editing are implemented. Accounts support name/opening-balance corrections; debit cards and income sources can be renamed. Transactions now supports text search plus type, account, and parent/child category filters within the selected month. Android is the first implementation/test target; iOS validation comes after the Android application is complete.

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

This first APK is a development build, which uses Metro on your computer to load the JavaScript. The standalone build (`npm.cmd run build:standalone`) bundles the code for independent offline use. Metro is a development server, not a backend for financial records. No Expo account or EAS cloud build is required for this local Android workflow.

## Learn the files

| File | Purpose |
| --- | --- |
| `index.ts` | Registers the root React component with Expo. |
| `App.tsx` | Shared state, tab navigation, theme providers, and entry/planning modals. |
| `app.json` | App name, identifiers, appearance, icons, and native configuration. |
| `package.json` | Dependencies and development commands. |
| `package-lock.json` | Reproducible dependency versions. |
| `tsconfig.json` | TypeScript's compile-time checking rules. |
| `scripts/build-android.ps1` | Local Android generation/build command without requiring a phone. |

`View` arranges content; `Text` displays text; `ScrollView` allows scrolling. `StyleSheet.create` groups layout and appearance rules. `useColorScheme` reads the system's light/dark choice. `SafeAreaView` keeps content clear of system bars. Components are functions that return UI, similar in purpose to the composable functions in the Kotlin prototype.

## Next milestones

1. Starter installed and confirmed visible on OnePlus 8T.
2. Five-tab design preview implemented; see Lesson 2.
3. SQLite schema, startup initialization, repository and tested financial rules implemented. Native database creation and reopening verified on OnePlus 8T.
4. Account/card, category, income-source and transaction creation implemented. Transfers and credit-card repayments avoid double counting. Transactions support editing and deletion with confirmation.
5. Monthly budgets, copying past plans into drafts, category editing, and compact budget progress implemented; see Lesson 6.
6. Manual backup/restore, migration tests, and personal standalone Android builds implemented; see Lesson 5.
7. Setup-record corrections implemented in a separate milestone; see Lesson 7.
8. Version 1.3.0 installed on OnePlus 8T; editor smoke checks and unchanged-value saves passed, and pre/post-update records matched exactly. Remaining isolated-data and visual scenarios are tracked in the combined test checklist.
9. Transaction search and filters implemented and installed as version 1.4.0. Native controls, populated date search, type/account filtering, and no-match/clear behavior passed; the current backup validated in temporary SQLite. See Lesson 9 for remaining cases.
10. Version 1.5.0 implements subcategory allocations, categorized credit repayments, compact edit controls, an expense shortcut, inline remaining amounts and a native date picker. See Lessons 10–11 for compatibility and verification.
11. Finish the remaining Android device scenarios, then test and adapt on iOS.

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

Read [Lesson 4: forms and saved records](docs/04-forms-and-saved-records.md) for first-use steps and how drafts become saved transactions.

Read [Lesson 5: daily use, corrections and backups](docs/05-daily-use-corrections-and-backups.md) for standalone builds, transaction corrections, and backup/restore. Run `npm.cmd run build:standalone` for the personal Android APK with bundled code.

Read [Lesson 6: monthly budgets and category editing](docs/06-monthly-budgets-and-category-editing.md) for monthly planning, copying drafts, category relationships, and how derived remaining amounts work.

Read [Lesson 7: setup-record corrections](docs/07-setup-record-corrections.md) for account balance previews, safe updates, and reusable form components. Use the [combined Android test checklist](docs/08-combined-android-test-checklist.md) to verify both new milestones in one phone session.

Read [Lesson 9: transaction search and filters](docs/09-transaction-search-and-filters.md) for searching, combining filters, pure functions, and stable record IDs.

Read [Lesson 10: subcategory budgets and repayments](docs/10-subcategory-budgets-and-repayments.md) and [Lesson 11: compact controls and calendar](docs/11-compact-controls-and-calendar.md) for version 1.5.0.
