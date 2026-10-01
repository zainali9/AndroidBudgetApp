# Lesson 5: daily use, corrections, and backups

## What changes in this milestone

The Android standalone APK contains the JavaScript bundle, so it can start without Metro, USB forwarding, or a PC. Transactions can be edited or deleted. Settings contains manual backup export and restore.

The application ID remains `com.zaina.budgetapp`. Installation must be an update using the same signing certificate: do not uninstall or clear app storage to resolve an installation error. The schema remains version 1, and ordinary startup does not replace existing records.

## Correcting an entry

Open Transactions and select the entry's month. Use Edit to open its existing values. You can change the amount, date, account, category/source, optional debit card, transfer destination and note as applicable. Save updates the original database row rather than adding another transaction. The app switches to the saved date's month after an edit.

Delete asks for confirmation and reverses the transaction's effects on account balances and monthly spending. Deleting a credit repayment restores both its source bank balance and the amount owed; it does not create an expense. There is no undo history: an exported backup can restore the earlier complete dataset.

Transaction type is fixed in the edit form. If you entered income instead of an expense, delete that incorrect entry and enter the correct type. Editing account names/opening balances, category names and income-source names is not part of this milestone.

## Export a backup

In Settings, use Export backup. Android opens a folder picker; select a folder you can find again, such as a dedicated My Budget Backups folder. The app reports success only after writing the file. Cancelling the picker does not save a backup.

The JSON file includes accounts/opening balances, debit-card links, categories, income sources, transactions and budget-plan rows. It also contains a format/version marker and PKR currency marker. It is readable text, not encrypted. Choose a private destination and keep another copy off the phone. An export saved only on the same phone cannot protect against losing the phone. The application does not automatically upload records or send them to anyone.

Files saved through Android's folder picker live outside the app's private database directory. App-private records and recovery files are removed if the app is uninstalled or its storage is cleared; keep exported backups separately.

## Restore a backup

Use Restore backup and choose a supported JSON file. The app checks its format and displays the number of accounts and transactions before asking whether to replace all current records. Restore is a replacement, not a merge: records created after the backup will not be present afterward.

Before changing SQLite, the app writes a local `budget-before-restore.json` recovery copy. Export recovery copy becomes available in Settings. If you restored the wrong valid backup, export that recovery copy and then restore the exported file. The recovery copy is replaced by the next confirmed restore, so export it first if needed.

Restore accepts version 1 My Budget PKR files up to 10 MB and 20,000 total records. It validates field types, dates, integer amounts, IDs, table relationships, category depth, debit-card links and resulting balances. Future backup versions are rejected until the app supports them.

All table replacement occurs in one SQLite transaction. If any insert, reference, validation or calculation fails, SQLite rolls back to the records that existed before the restore. A cancelled picker or confirmation does not replace records. A malformed file cannot trigger SQL commands: values are bound as parameters, and table/column names come from a fixed allowlist in the app.

## How edits work in React

EntryForm now accepts `initial` and `entryId` props. Initial values fill the controlled inputs. The ID tells the repository to run UPDATE instead of INSERT. The amount is formatted back into editable text using whole rupees plus a two-digit paisa remainder, avoiding a floating-point rounding step.

A ref holds the initial draft snapshot. The current snapshot is compared with it to decide whether Cancel/Back needs a discard confirmation. Simply opening an existing transaction and closing it does not warn about unsaved changes.

After a correction or deletion, the same revision signal from Lesson 4 refreshes the shared screen snapshot. Balances are recalculated from records, so there is no separate balance cache to repair.

## How backup code is divided

| File | Role |
| --- | --- |
| `src/data/storage.ts` | Entry lookup/update/delete, backup serialization, validation and atomic restore |
| `src/components/BackupControls.tsx` | Folder/file pickers, replacement confirmation, recovery copy and status messages |
| `src/screens/EntryForm.tsx` | Pre-filled transaction edit form |
| `src/screens/BudgetScreens.tsx` | Edit/Delete controls and Settings backup controls |
| `scripts/build-standalone.ps1` | Build a bundled Android release variant using the preserved local key |

The repository contains no Android file-picker code. That lets Node tests exercise the same financial and restore logic using real SQLite. Expo file libraries handle the mobile file operations.

Android export uses the Storage Access Framework folder picker. Restore uses DocumentPicker with a temporary cached copy, which is removed after use. iOS uses a share sheet for export; its behavior is implemented but untested, and dismissing the sheet does not prove a file was saved.

## Development build versus standalone build

A development APK loads editable JavaScript from Metro. A standalone release variant bundles JavaScript and assets inside the APK, making normal app startup independent of the computer. It still uses the same local SQLite file on the phone.

From PowerShell, with Node, JDK 17 and the Android SDK configured:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build:standalone
```

Output: `android/app/build/outputs/apk/release/app-release.apk`.

The script preserves the existing local debug signing key under ignored `build/local-signing/` before Expo regenerates Android sources. The standalone APK is signed with that same local development key to support personal in-place sideload updates. It is not a Play Store production signing setup. Keep the key safe and do not publish the APK as a production distribution. A dedicated production key and distribution plan will be needed later.

Future TypeScript changes do not automatically update the standalone app. Rebuild and install an updated APK. Metro is only needed when using the development APK again.

## Validation

The automated suite has 19 tests, including consistent UTF-8 byte limits for multilingual backup text. New cases cover:

- Editing the original row, including moving an expense to another month/account.
- Reversing a deletion and rejecting unsafe edits/deletes without partial changes.
- Deleting a credit repayment without adding spending.
- Export/restore of every table, preserving IDs, relationships, balances and plans.
- Rejecting malformed JSON, incompatible versions/currencies, duplicate IDs, invalid dates and invalid references while preserving current data.

Build and device results are appended below. Desktop tests do not verify the Android folder picker or a standalone cold launch; those need a device check.

References: [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/), [DocumentPicker](https://docs.expo.dev/versions/latest/sdk/document-picker/), [Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/).

### Validation results — 2026-10-01

- All 19 automated tests and strict TypeScript checking passed.
- First standalone native build succeeded in 11m 10s; the final incremental build with backup consistency fixes succeeded in 54s.
- APK signature verification passed. Package `com.zaina.budgetapp`, version 1.1.0 / code 2, ARM64, minimum API 24, target API 36. No debuggable flag was reported by APK metadata inspection.
- The APK includes `assets/index.android.bundle` (1,512,400 bytes); APK size is 30,303,813 bytes.
- Signing certificate SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` (preserved local development key).
- The phone was disconnected. Installed-certificate comparison, in-place installation, native backup picker flows and offline cold launch are still pending. No phone records were read, replaced or cleared during this milestone.
- iOS remains untested. This is a personal sideload build, not a Play Store production release.

### Standalone device follow-up — 2026-10-01

- The installed APK and standalone APK signing certificates matched. A stopped-app database snapshot was preserved in ignored local build output before the update; its integrity check passed.
- Version 1.1.0 / code 2 installed successfully as an update. The app reached Home on two cold starts with no ADB reverse forwarding to Metro.
- Android backup export succeeded to `Documents/MyBudgetBackups`. The exported data matched the pre-update snapshot exactly for all six tables: 3 accounts, 1 debit card, 8 categories, 3 income sources, no transactions, and no budget plans.
- Restore successfully opened the exported file and displayed the correct account/transaction counts and replacement confirmation. The test was cancelled; no restore replacement was performed on the user's database. Atomic replacement/rollback remains covered by the SQLite tests.
- The app was left on Home. The user can now disconnect the phone from the PC and use the bundled standalone app. Current data was preserved; local snapshots and exported financial data are not committed.
