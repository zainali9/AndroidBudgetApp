# Milestone 2: screens, navigation, and Compose state

## What you can try

Run the `app` configuration on your phone. Visit Home, Transactions, Budgets, Accounts, and Settings using the bottom bar. The banner marks every screen as sample data.

- Use the arrows beside the month. Other months have an empty state instead of showing the same sample purchases under a different date.
- The selected month is shared by Home, Transactions, and Budgets.
- Press Android Back from another tab to return Home.
- Tap the plus button on Home or Transactions to open the expense preview. Dismiss it by swiping down, using Back, or tapping Got it. It does not save anything.
- Rotate the phone: the selected tab and month should remain selected.
- Follow your phone's light/dark appearance setting. Both versions also have Android Studio previews.

## Read the code in this order

1. `MainActivity.kt`: the activity now hosts `BudgetApp()`. The original greeting and its preview remain available as a learning example.
2. `ui/BudgetApp.kt`: the shared screen structure, navigation, and individual screen functions.
3. `ui/SampleData.kt`: temporary sample records and PKR formatting, separated from the interface.
4. `ui/theme/Theme.kt`: semantic light/dark colors used throughout the screens.

## Android and Kotlin concepts

### One activity, multiple screens

An Activity is an Android-managed host. We do not need a separate Activity for every tab: our Activity displays one root composable, which selects the appropriate screen. These five peer tabs currently use a small enum and saved selection. A navigation library can be introduced when nested screens, arguments, or deep links need a richer back stack.

### Composable functions describe UI

`@Composable` marks a function that describes interface content. `Column` lays out children vertically and `Row` horizontally. Smaller composables such as `BudgetCard` and `InfoRow` let us reuse consistent layouts.

Compose may run a composable again when the state it reads changes. This is recomposition. Avoid doing file writes or database inserts just because a composable is being drawn.

### State and callbacks

`var selectedTab by rememberSaveable { mutableStateOf(...) }` creates observable UI state. The `by` keyword lets Kotlin delegate reads and writes to the state object. When a tab updates that state, Compose updates the UI.

`rememberSaveable` preserves supported values across activity recreation; it is not a database and does not promise permanent storage after closing or force-stopping an app.

The month selector receives a value and an `onChange` callback. The root owns the selected month so all three monthly screens agree. This pattern is called state hoisting: move shared state to the common parent and let child components request changes.

A saveable state holder keeps each tab's scroll position separate.

### Scaffold and insets

`Scaffold` provides slots for the top bar, bottom bar, floating action button, and main content. Its `innerPadding` keeps content clear of those bars and the system UI. We consume those insets after applying the padding so descendants do not apply the same space again.

### Theme instead of scattered colors

Screens use names such as `primary`, `onSurface`, and `primaryContainer`. The theme supplies the actual colors for light and dark mode. Content colors should contrast with their corresponding surfaces.

### Long values for money

Sample money values are integer paisa (`Long`). For example, 1,250,000 paisa is PKR 12,500.00. `BigDecimal` formats the integer amount without first turning it into floating-point currency. The progress bar uses a floating-point ratio only for drawing, not for financial arithmetic.

### Preview versus runtime

`BudgetAppPreview` and `BudgetAppDarkPreview` let Android Studio render the root UI without launching the phone app. Preview annotations have no effect on the actual phone screen.

## Scope

This milestone is a navigable design preview. There is no Room database, transaction saving, editable account setup, budget copying, or real spending chart yet. The app keeps the starter application ID for update compatibility. Automatic backup configuration is still scheduled for the storage milestone, before real financial records are introduced.

## Verification

The navigation instrumentation tests run inside Android on a connected device. They cover switching tabs, Back behavior, a shared month, activity recreation, and opening/dismissing the expense preview. Lint checks Android-specific issues; compilation checks that the app can be packaged.

### Verified on 2026-09-25

- Debug APK built and installed on OnePlus 8T / Android 14.
- Four connected-device tests passed (three navigation/UI tests plus the starter context test).
- Android lint passed with zero errors and 15 existing starter/dependency warnings.
- Dark-mode Home layout visually inspected on the phone: labels, month selector, sample banner, scrolling, and fixed navigation are readable.
- Light mode has a Compose preview but has not been visually inspected on the physical device.
- The first device run was blocked by the lock screen; tests passed after unlocking. Keep the device unlocked for UI tests.
