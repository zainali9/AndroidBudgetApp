# Lesson 2: navigation and the budget preview

## What this milestone builds

The starter now has Home, Transactions, Budgets, Accounts, and Settings tabs. Home places the expense pie immediately below "Your month at a glance", followed by total spending and compact budget bars. Categories are ordered by their planned budget, largest first. Transactions show income in green and expenses in red. The floating + button opens an expense-entry explanation.

This is a design preview. Sample records are deliberately labeled. The + sheet is not an editable form yet, and settings describe future features. No financial data is saved. Samples appear only in the month in which the app started; other months show empty states. Account balances are illustrative, not calculated ledger balances.

## Where to look

| File | Responsibility |
| --- | --- |
| `App.tsx` | Root providers, selected tab/month, bottom tabs, Android Back handling, expense modal |
| `src/theme.ts` | Shared light/dark colors and the theme context |
| `src/sampleData.ts` | Typed sample records, PKR formatting, month helpers, chart calculations |
| `src/components/Common.tsx` | Reusable labels, headings, cards, icons and month selector |
| `src/components/ExpensePieChart.tsx` | Pie geometry and category legend |
| `src/screens/BudgetScreens.tsx` | Contents of the five screens and compact budget cards |
| `tests/sampleData.test.mjs` | Money, month boundary, reconciliation and chart edge-case checks |

Read App.tsx first, then follow its imports. Components starting with capital letters are pieces of UI. A `.tsx` file combines TypeScript with JSX markup. A `.ts` file contains TypeScript without JSX.

## State: values that change the screen

```tsx
const [tab, setTab] = useState<Tab>('Home');
const [month, setMonth] = useState(previewMonth);
```

`tab` is the current value. Calling `setTab('Accounts')` asks React to render again with that value. You do not manually hide one screen and draw another. React calls the components again and updates the native views that changed.

`Tab` is a TypeScript union of the five allowed names. It catches misspelled screen names during development. TypeScript does not store data or replace runtime validation of future user input.

The tab and month state live in BudgetApp, above all five screens. This is called lifting state up: related screens share one owner. Changing the month on Home also changes the month seen on Transactions and Budgets. Switching tabs preserves the month. A new app process resets this in-memory state. SQLite will provide durable storage in a later milestone.

`useState(currentMonth)` passes a function as an initializer. React uses it to establish the preview month rather than recalculating that value on every render.

## Props: information passed into a component

```tsx
<BudgetScreens tab={tab} budgets={budgets} hasSamples={month === previewMonth} />
```

Props are named inputs. BudgetScreens receives the selected tab, the budgets for the selected month, and whether to show sample transactions. It chooses the content to display. MonthSelector receives an `onChange` function: pressing an arrow calls it to update the parent's state. Data flows down through props; callbacks allow a child to request a change.

BudgetCard is reused on Home and Budgets. Its optional `detailed` prop adds the remaining amount on Budgets. Fixing the common card fixes both screens.

## Navigation and Android Back

For these five peer screens, a small state-driven tab bar is enough. We have not added a full navigation library yet. Nested forms, screen history and deep links may justify one later.

Android Back returns from another tab to Home. At Home it falls through to the normal Android behavior. A `useEffect` registers the BackHandler listener; its cleanup removes the old listener when it changes or the component unmounts. The `[tab]` dependency ensures the handler uses the current tab.

The expense preview uses React Native Modal. While it is open, its `onRequestClose` handles Android Back. The Got it button and backdrop also close it.

The ScrollView has `key={tab}`. Changing tabs creates a fresh scroll container so each screen starts at the top. It does not preserve separate scroll positions.

## Layout and styling

View is a layout container, Text displays words, Pressable handles taps, and ScrollView allows content taller than the phone. React Native styles are JavaScript objects, not browser CSS. Most sizes use density-independent units rather than physical screen pixels.

`flex: 1` fills available space. `flexDirection: 'row'` places children horizontally. `gap` separates children. The floating button uses absolute positioning within the content area, above the tab bar. Bottom padding prevents the last content from hiding behind it.

SafeAreaProvider and SafeAreaView account for system bars and cutouts. A theme context lets nested components read the same colors without passing a theme prop through every layer. `useColorScheme` follows the phone's appearance. We provide different red and green shades for dark backgrounds.

Accessibility labels identify icon-only buttons. Tabs expose their selected state. Budget bars expose progress values; the chart also has a textual legend. These are foundations, not a claim of completed screen-reader or large-text testing.

## Money, budgets and the pie

Amounts are integer paisa: `1250000` means PKR 12,500.00. The formatter separates whole rupees and the two-digit remainder. It rejects fractional paisa and unsafe integers. Later transaction entry must validate user text before converting it, and ledger calculations must check numeric bounds as well.

The budget bar is `spent / planned`. Its visual width stops at 100%, while the text can report overspending. A future real zero-budget expense requires explicit treatment in the financial model; the present samples all have positive plans.

The pie uses actual spending, not planned allocations. Each category's angle is `spent / total * 360`. Zero-spend categories contribute no slice. A single category is drawn as a circle; multiple categories use SVG arc paths. With no spending, the component shows an empty message instead of dividing by zero.

`react-native-svg` supplies native drawing components for the chart and tab icons. Adding it changes the Android application's native dependencies, so we must rebuild/install the APK once. Later ordinary TSX edits can use Metro's Fast Refresh.

## How to run and check this milestone

From this repository in PowerShell:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd start -- --localhost
```

Use a second terminal for installation if a native dependency changed:

```powershell
npm.cmd run build:android
$adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adbPath install -r android/app/build/outputs/apk/debug/app-debug.apk
& $adbPath reverse tcp:8081 tcp:8081
```

Open My Budget's development build and connect to the local Metro server. The `start` script prefers IPv4 so USB forwarding can reach it. Metro provides development code; it is not a financial-data backend.

Try these checks on the phone:

1. Home: pie directly below its heading, spending PKR 23,000.00, compact bars ordered Food, Transport, Shopping.
2. Transactions: Salary green, purchases red.
3. Previous month: empty states. Switch tabs and confirm the same month remains selected; return to the current month for samples.
4. Accounts: bank/cash balances and a separately labeled credit-card amount owed.
5. Settings: PKR and clearly labeled upcoming features.
6. +: opens the preview; Back dismisses it. Back from another tab returns to Home.
7. Scroll to the last card and check the tab bar and + button do not block it.

The automated tests cover currency formatting, year rollover, isolation of sample data, agreement between dashboard and transaction totals, and empty/single-category pie geometry. They do not prove device layout or accessibility. Android is the current test target; iOS remains unverified.

## Small exercises

Change a sample category's planned amount and observe its percentage bar. Change a spent amount and observe the pie and total. Since transactions are separate fixtures for now, update the corresponding transaction too: the reconciliation test will catch a mismatch. Change a theme color to see how context updates components throughout the app.

## Next milestone

Introduce a versioned local SQLite schema and tested financial rules. Accounts, credit debt, income, expenses and transfers need a consistent ledger before editable forms are wired up. Then replace the fixtures with database queries, implement saving, and verify records survive closing and reopening the app.

## References

- [React Native BackHandler](https://reactnative.dev/docs/backhandler)
- [Expo SVG library reference](https://docs.expo.dev/versions/latest/sdk/svg/)

### Validation status for the five-tab milestone

- Four focused Node tests passed; TypeScript passed; the Android JavaScript bundle exported successfully.
- Expo's online compatibility check now recommends Expo 57.0.26 instead of the installed 57.0.25. The earlier starter check passed before this patch recommendation; this milestone has not upgraded Expo during the native build.
- Node's test runner reports a module-type detection warning when importing the TypeScript helper; all tests complete successfully.
- Native build and device checks are recorded below when completed.
- Native Android debug build succeeded in 5m 15s with the SVG dependency included. Device interaction checks remain pending because the OnePlus is locked.

### Device follow-up

The updated APK installed successfully on the OnePlus 8T (2026-09-29, device lastUpdateTime 18:49:19). The existing Metro process became unresponsive; restarting it restored Android bundling (803 modules). Phone interaction checks still require an unlocked screen. If a development build appears blank, check that Metro is responding and USB forwarding is active before rebuilding the APK.

### Owner confirmation — 2026-09-30

The owner confirmed that month arrows, shared month selection between tabs, and the expense preview with Android Back dismissal work. Automated device inspection separately confirmed Home, Transactions and Budgets content; screenshots were black, so color/layout inspection was not independently completed.
