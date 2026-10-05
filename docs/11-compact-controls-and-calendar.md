# Lesson 11: compact controls and a native calendar

Version 1.5.0 includes the six requested planning and usability changes. Lesson 10 explains the financial logic and migration; this lesson explains the interface.

## Compact editing in Settings

`EditableRow` puts the name and description on the left and a pencil icon on the right. It replaces the full-width edit buttons for categories, subcategories and income sources. Add and backup controls remain full-size. The pencil uses the existing SVG icon system, so no icon package is required.

A small visible icon still needs a usable touch target. Its button is at least 48 layout units wide and tall and has a screen-reader label such as “Edit Groceries.” `flexDirection: 'row'` places the text and pencil side by side; `flex: 1` lets the text use the available space.

## Expense shortcut and progress rows

Transactions has an Expenses button directly below Transfer / repay card. Both that button and the floating + call the same `openForm('expense')` path. Sharing the handler prevents two subtly different expense forms.

Each budget card now places spent/planned amounts and remaining/over-budget amounts in the same horizontal row. The latter is right-aligned. Both halves can wrap their own text on narrow screens or with large fonts. The progress bar sits below this row.

## Native calendar selection

Expense, income and transfer forms all use the shared `DateField`, including when editing existing entries. Tapping the displayed date dismisses the keyboard and opens a native date selector. Android uses its calendar dialog; selecting OK updates the draft and cancelling leaves the original date intact. Saving the transaction is still a separate action. The iOS implementation uses an inline picker with Done, but has not been device-tested.

The project installs `@react-native-community/datetimepicker` with `npx expo install`, which selects the version compatible with this Expo SDK. See the [official Expo documentation](https://docs.expo.dev/versions/latest/sdk/date-time-picker/). This package includes native Android code, so a new APK is required; refreshing JavaScript alone cannot add it to an already installed build.

Dates are stored as YYYY-MM-DD, without a time. The component constructs a local-noon Date from the year, month and day and formats the result using local date parts. Parsing the text as UTC and converting it to local time could otherwise shift the day. The existing database date validation remains in place.

## Android verification checklist

Use disposable data for checks that save or delete records. On the daily-use phone, make a fresh backup before updating, install with `adb install -r`, and compare an exported backup afterwards. Never uninstall the app or clear its storage to fix an update.

- [x] Strict TypeScript checking passed.
- [x] All 36 desktop tests passed, including migration and financial invariants.
- [x] Standalone version 1.5.0/code 6 build and signing verification (8m 41s; matching existing certificate).
- [x] Fresh backup, in-place phone update, and strict pre/post record comparison passed.
- [x] Settings pencils open parent, subcategory and income-source editors; dark-mode screenshot visually inspected.
- [x] Expenses shortcut opens Add expense; both routes share the handler.
- [x] Calendar opens in expense, income and transfer forms. Expense cancellation preserves the date; selecting October 6 updates the draft, which was discarded.
- [x] Existing transaction editing opens its calendar on the saved date; cancelled without saving.
- [x] Entering 123.45 on a child updates its parent draft total to PKR 123.45. The draft was discarded; record preservation is checked by the backup comparison below.
- [x] Legacy parent limits remain visible; Save plan opens the replacement confirmation. Keep editing was selected and the form closed without saving.
- [x] Home screenshot inspected in dark mode: remaining sits beside spent/planned and aligns right; long amounts wrap inside their column.
- [x] Standalone cold start without Metro passed; phone left on Home.

iOS remains unverified. Home and Settings layouts were inspected in dark mode on the OnePlus 8T. Light mode and enlarged font scaling still need device checks. Successful TypeScript or SQLite tests alone do not establish visual correctness.

Additional check: the private backup exported earlier on 2026-10-05 was restored into a temporary version-1 SQLite database on the PC and migrated. All existing accounts, cards, sources, transactions, categories and ten budget allocations were preserved; one missing default subcategory was added. Balances and a version-2 backup roundtrip matched. This was a PC dry run, not a restore on the phone.

## Completed Android verification — 2026-10-05

Installed version 1.5.0/code 6 on the OnePlus 8T using the existing certificate and an in-place update. The native calendar was checked in all three transaction forms, including selection, cancellation and editing a saved date. Credit destination selection showed the repayment label. Budget rollup and legacy-limit confirmation were exercised only as drafts; no test entries or allocations were saved on the daily-use phone.

Pre-update export: my-budget-2026-10-05T05-37-14-508Z.json. Post-update export: my-budget-2026-10-05T05-47-38-743Z.json. Both remain in Documents/MyBudgetBackups, with private local copies under ignored build/device-1.5-check. The strict comparison preserved every account, card, source, budget allocation and original category. Transaction IDs, amounts, dates, notes and financial links were preserved; only credit repayment category links changed as designed. The missing default subcategory was added. Final counts: 3 accounts, 22 categories, 3 sources, 1 debit card, 3 transactions and 10 budget allocations.

The phone was left on Home after a successful standalone cold start with no Metro reverse forwarding. iOS remains untested. Financial save/copy/restore scenarios were tested in disposable desktop SQLite databases; the phone checks deliberately avoided replacing or adding financial records.
