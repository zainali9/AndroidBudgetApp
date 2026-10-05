# Lesson 9: finding transactions with search and filters

## What this milestone adds

Version 1.4.0 adds search and filters to **Transactions**. As your ledger grows, you can narrow the selected month's entries without scrolling through every record. The existing expense add button, income/transfer controls, and transaction Edit/Delete actions remain available.

This is a separate milestone from budgets/category editing and setup corrections. No server, dependency, database migration, or new backup format is needed.

## Use search

1. Open **Transactions** and select a month using the arrows at the top.
2. Type into **Search notes, names or dates**.
3. Matching entries update as you type.

Search checks transaction notes, account and transfer-destination names, category/parent names, income-source names, debit-card names, and the stored date (`YYYY-MM-DD`). It does not search monetary amounts or automatically scan other months.

Search ignores letter case, trims surrounding whitespace, and treats multiple spaces as separators. Every search word must appear somewhere in the entry's searchable text, in any order. For example, `groceries bank` can match a groceries expense paid from an account with Bank in its name. Urdu text can be searched too. Unicode normalization lets equivalent forms, such as full-width Latin letters, match ordinary letters.

Punctuation is literal: `%` is a percent sign, not a wildcard. Search does not interpret regular expressions or SQL. This is text matching over records already loaded for the month.

## Combine filters

Tap **Show filters** to reveal three controls:

| Filter | Meaning |
| --- | --- |
| Transaction type | All types, expenses, income, or transfers/repayments |
| Account | Entries paid from or received into that account; transfers match either end |
| Expense category | Expenses assigned directly to the category or, for a parent, to its children |

Filters combine with search. Selecting Food, an account, and a search phrase requires all three conditions to match.

Choosing a category shows expenses only. Changing the type to Income or Transfers clears the category filter because those records do not have expense categories. The category control reappears when you choose All types or Expenses.

Account and category matching uses numeric IDs. Renaming a record does not break a selection. A parent category's current grouping is used, consistent with the dashboard: moving a subcategory changes which parent filter includes its past expenses.

**Hide filters** collapses the controls while keeping their selections active. The button shows the number of active type/account/category filters. **Clear filters** resets both search text and all selections in one tap.

The **Showing X of Y transactions** line compares matching entries with the total entries in the selected month. No matching transactions means records exist for that month but are excluded by your current search/filters. No transactions this month means that month's ledger is empty.

## What changes when navigating or editing

Changing the month keeps your filters so you can compare the same account or category across months. Switching away from Transactions and returning resets them, because this screen is mounted again. Filters are temporary screen state and are not stored in SQLite or backups.

Saving, editing, or deleting a transaction refreshes the list using the active filters. If an edit makes an entry stop matching, it disappears from the filtered list; use Clear filters to see the month's full list. Likewise, a new entry can be hidden by active filters. The transaction form still switches to the saved date's month.

Filtering never changes account balances, dashboard spending, or budget remaining. It only chooses visible rows. A credit-card repayment remains a transfer even when viewed through a credit-card account filter.

## How the code is organized

The old Transactions section now lives in its own `TransactionsScreen.tsx` component. Moving it out of the multi-screen component makes room for local search/filter state and keeps the other tabs simpler. Existing edit/delete behavior moved with it.

`useState` stores the query, selected IDs, selected transaction type, and whether the filter controls are expanded. Each input is controlled: its displayed value comes from state, and user interaction calls a setter.

`useMemo` recalculates visible rows when either the month's records or the filter state changes. It is a React optimization; it is not a database cache and does not save records.

`filterTransactions` is a **pure function**: its output depends on its arguments, and it does not modify them or write to the database. It applies each condition and preserves the existing newest-first order. This makes it straightforward to test without a phone.

The repository query now returns `accountId`, `destinationId`, `categoryId`, and `categoryParentId` alongside display names. These are aliases for columns that already exist. They are extra fields in the query result object, not new database columns. This is why a schema migration is unnecessary and backups remain compatible.

The root scroll view now allows handled taps while the keyboard is open, so filter buttons can respond without requiring a separate tap just to dismiss the search keyboard.

## Files to read

| File | Role |
| --- | --- |
| `src/data/transactionFilters.ts` | Filter type, initial values, pure matching logic |
| `src/screens/TransactionsScreen.tsx` | Search, filter controls, matching counts, result list, Edit/Delete |
| `src/screens/BudgetScreens.tsx` | Passes saved records and callbacks to the extracted screen |
| `src/data/storage.ts` | Transaction query exposes stable IDs alongside labels |
| `App.tsx` | Main scroll-view keyboard tap handling |
| `tests/storage.test.mjs` | SQLite-backed fixtures and filter regression tests |
| `app.json` | Version 1.4.0 / Android versionCode 5 |

## Automated verification

All 32 tests pass, including the prior financial/storage suite. Four new cases cover:

- Account IDs despite duplicate names, incoming/outgoing transfer matches, and selected-month isolation.
- Direct parent expenses, child-category expenses, exact child selection, and combined conditions.
- Case, whitespace, multiple words, Urdu, Unicode normalization, dates, and literal punctuation.
- Preserved order, unchanged database records, and results after account renaming or category regrouping.

Strict TypeScript checking passes. The fixtures use real SQLite and invented test records on the PC. They do not put sample data into the phone's daily-use database.

## Phone checks

- [x] Install 1.4.0 in place, preserving the existing package, signing key, and data.
- [x] Type a search, show/hide filters, choose a transaction type/account/category, and clear all filters.
- [x] Check keyboard behavior and the empty-month state without creating dummy financial records.
- [ ] With suitable real entries or an isolated test database, verify populated matches, no-match messages, transfer direction, parent/child matches, and editing a filtered entry.
- [x] Confirm the current month/filter combination is understandable when moving between months.
- [x] Validate the current export against the pre-update snapshot and cold-launch without Metro (see the October 5 follow-up and comparison interval below).

Device/build outcomes are recorded below. iOS remains untested.

### Build results — 2026-10-01

- All 32 automated tests and strict TypeScript checking passed.
- Android standalone release build and release lint checks passed in 6m 11s.
- Verified package `com.zaina.budgetapp`, version 1.4.0 / code 5, ARM64, minimum API 24, target API 36. No debuggable flag was reported by APK metadata inspection.
- APK size: 30,330,013 bytes; embedded JavaScript bundle: 1,538,596 bytes.
- Signature verification passed; SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` matches the preserved certificate used by the installed app.
- Output: `android/app/build/outputs/apk/release/app-release.apk`.
- The phone remained connected but locked. Version 1.4.0 was not installed; no phone records were changed. Search/filter UI and keyboard checks remain pending on-device. The previously installed version is 1.3.0.
- Existing populated-budget/category-change device scenarios also remain on the combined checklist; this milestone does not mark those tests complete. iOS remains untested.

### Installation and filter checks — 2026-10-01

- Version 1.4.0 / code 5 installed successfully over 1.3.0 using an in-place update. The installed and update APK certificates matched. A fresh pre-update backup was exported before installation.
- A standalone cold start succeeded with no Metro reverse forwarding. Home and Transactions opened successfully.
- Search typing, opening filters while the keyboard was visible, selecting expense/account/category filters together, and collapsing the panel passed. The three active filters persisted when moving from October to November. Clear filters reset selections and emptied the search input.
- Changing the type to Income cleared the category filter and hid category controls. Leaving Transactions and returning reset its temporary filters.
- The data had no transactions, so these are native UI/empty-state checks. Populated search matches and filtering calculations remain covered by desktop SQLite tests, with populated device scenarios still pending. No sample financial records were created.
- Automatic approval review hit a usage limit before the final post-update export command could run. Consequently the final backup comparison and final cold-start follow-up were not completed in that session.

### Resumed verification — 2026-10-05

- Confirmed the phone still runs version 1.4.0 / code 5. After unlocking, exported a fresh backup successfully to `Documents/MyBudgetBackups/my-budget-2026-10-05T04-48-24-879Z.json`. The phone database was not restored or overwritten.
- Validated the export and restored it into a temporary, in-memory SQLite database on the PC. Re-exported table contents matched exactly, including IDs and relationships. This validates the actual backup using the repository restore path; it is not a device restore test.
- Current records: 3 accounts, 21 categories, 3 income sources, 1 debit card, 1 transaction, and 10 budget allocations. Compared with the October 1 pre-update snapshot, 13 categories, 1 transaction, and 10 allocations were added; no original rows were modified or missing. The comparison spans several days rather than immediately surrounding installation, and new records were retained.
- Standalone cold start passed with no Metro reverse forwarding. Home loaded successfully.
- Read-only checks with the real October transaction passed: matching type and account each showed 1 of 1 entries, a different type showed 0 of 1 and the no-match message, and clearing restored the full list. Searching the saved date matched the entry; an invented unmatched query showed no match; clearing restored it.
- No sample transactions were added and no financial records were edited. Filters were cleared and the app was left on Home.
- Remaining device cases include populated transfer-direction and parent/child category filtering, editing a filtered entry, and the earlier populated-budget/category-regrouping scenarios. Desktop coverage remains 32 passing tests; iOS remains untested.
