# My Budget App

An Android budgeting app being built step by step while learning Android development.

## Current checkpoint

Milestone 2 adds five navigable Compose screens, a shared month selector, a sample spending overview, and an expense preview sheet. All displayed financial amounts are sample data; persistent storage and editing are not implemented yet. The original greeting remains as a learning preview. See [the milestone 2 walkthrough](docs/milestone-02.md).

- Current application ID: `com.example.mybudgetapp` (starter identifier; review before release).
- Minimum Android version: Android 8.0 / API 26.
- Planned currency: PKR, with amounts stored as integer paisa.
- No application server is planned.
- The starter's automatic backup settings are still present; configure device-only storage before adding real financial records.

## Open and run

1. Open this repository in Android Studio and allow Gradle sync to finish.
2. Install SDK components requested by Android Studio.
3. Select a connected, authorized Android phone or an emulator.
4. Run the `app` configuration.

Android Studio manages the Java runtime used by Gradle. For command-line builds, use a compatible Java installation and run `gradlew.bat :app:assembleDebug` on Windows.

## Understanding the starter

- `MainActivity.kt`: Android opens this activity; `setContent` supplies its Compose interface.
- `@Composable`: identifies a function that describes part of the interface.
- `Greeting`: displays text using the supplied name.
- `GreetingPreview`: renders a design-time example in Android Studio; it is separate from the phone's content.
- `ui/theme`: the app's colors, typography, and theme.
- `AndroidManifest.xml`: declares the application and its launch activity.
- `app/build.gradle.kts`: the app's build settings and dependencies.
- `gradle/libs.versions.toml`: dependency names and versions.
- `gradlew` / `gradlew.bat`: launch the project's specified Gradle build tool.

## Implementation milestones

Each milestone should be independently reviewable, checked, and committed.

1. **Starter checkpoint**: preserve the running app, ignore local/generated files, and document the project.
2. **Navigation and layouts**: Home, Transactions, Budgets, Accounts, Settings, and the expense add button. Verify navigation on the phone.
3. **Local database and money rules**: Room records, integer paisa, derived balances, atomic transfers, device-only backup configuration. Test calculations and persistence.
4. **Accounts and cards**: cash/bank opening balances, linked debit cards, credit-card opening debt and optional limits. Archive accounts with history.
5. **Categories and income sources**: main categories, one optional subcategory level, user-defined income sources, and safe renaming/archiving.
6. **Income and expenses**: create, list, filter, edit, and delete transactions; verify all affected account totals.
7. **Transfers and card payments**: move money without counting it as income or a second expense; test both sides of each transfer.
8. **Monthly budgets**: category plans, spent/remaining totals, overspending, and copying a selected prior month's planned amounts. Test month boundaries.
9. **Dashboard**: actual monthly expense pie chart, largest assigned budgets first, two-tone spent/remaining bars, empty states, and overspending display.
10. **Manual backup and restore**: validated export/import, replacement confirmation, and database migrations. Test round-trip restoration and invalid-file handling.
11. **Version 1 release**: calculation and device checks, update/data-retention checks, signed APK, and a version tag. Keep the signing key outside Git.

## Financial rules

- Opening balances are not monthly income.
- Debit cards use their linked bank account's funds.
- Credit-card purchases count as expenses and increase debt.
- Credit-card repayments reduce bank funds and card debt, without counting as another expense.
- Transfers are neither income nor expenses.
- Subcategory expenses contribute to their parent category's budget.
- Copying a budget copies planned amounts, not transactions or unused balances.
- Expense edits/deletions must update the affected accounts, months, categories, and dashboard totals.

## Git checkpoints

A commit saves a local snapshot. A push uploads commits to GitHub. Local SDK paths, IDE state, build outputs, and signing secrets are excluded. Explain each milestone's changes and verification alongside its commit.
