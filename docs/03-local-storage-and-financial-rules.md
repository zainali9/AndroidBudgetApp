# Lesson 3: local storage and financial rules

## The milestone

We added the storage foundation beneath the five-screen preview. On startup, the app opens a local file named `budget.db` and creates version 1 of its database structure. It does not seed financial records. The screens still display clearly labeled sample data, and the + panel is still a preview. Creating records through forms and showing database records on screen are the next milestone.

This separation lets us test money handling before we connect editable forms. A correct-looking screen can still calculate an incorrect balance; the repository tests check the underlying rules directly.

## React state versus SQLite

React state holds values such as the selected tab and month in memory. SQLite stores structured records in a file inside the application's storage on the phone. That file survives ordinary app restarts. Uninstalling the app or clearing its storage removes local records; manual backup/restore will come later. No backend or network account is involved.

The Expo SQLite library connects JavaScript to the native SQLite implementation. Because this is a new native dependency, the development APK must be rebuilt and installed. Later edits to the TypeScript financial rules normally use Metro without rebuilding native code.

## Files to read

| File | Purpose |
| --- | --- |
| `src/data/storage.ts` | Database interface, schema migration, validation and repository methods |
| `src/data/DatabaseProvider.tsx` | Opens storage, initializes it, provides the repository and handles startup failures |
| `App.tsx` | Wraps the preview in DatabaseProvider |
| `tests/storage.test.mjs` | Uses real SQLite to test persistence and financial behavior |
| `app.json` | Registers the Expo SQLite config plugin |

Start with `parsePkr`, then `BudgetRepository.record`, then `migrate`. These show validation, saving, and database creation respectively.

## Tables and relationships

A table is a collection of records with defined fields. Each record has an ID. A foreign key links that ID to another table and prevents references to missing records.

| Table | What one row represents |
| --- | --- |
| `accounts` | Cash, a bank account, or a credit account, including its signed opening balance |
| `cards` | A named debit card linked to a bank account |
| `categories` | An expense category, optionally linked to a top-level parent |
| `income_sources` | A source such as salary or freelance work |
| `transactions` | Income, an expense, or a transfer |
| `budget_plans` | A planned category amount for one month; editing/query methods come later |

A credit card is itself a credit account. A debit card points to a bank account: it does not have an independent balance. We store card labels, not card numbers or security codes.

This first repository permits one subcategory level. For example, Food -> Groceries is valid. A third level is rejected. Future category-edit methods must preserve this rule. Monthly plan editing and copying are not implemented yet.

## Money uses integer paisa

`parsePkr('123.45')` returns `12345`. It parses the digits instead of multiplying a floating-point decimal by 100. Inputs with commas, negative signs, exponential notation, more than two decimals, or values outside the safe integer range are rejected. Zero can be parsed, but a transaction must have a positive amount.

JavaScript Number cannot represent every integer above `Number.MAX_SAFE_INTEGER`. Validation keeps stored amounts within that range. BigInt provides exact intermediate arithmetic when calculating balances, then the result is range-checked before conversion back to Number. BigInt is not passed into the Expo database API.

Names must contain 1–100 characters, notes are limited to 500, and dates use a validated `YYYY-MM-DD` calendar date. Storing calendar dates avoids shifting purchases to another day through time-zone conversion.

## Balances and credit debt

All account balances use the same signed convention: positive means money available or credit in your favor; negative means debt/overdraft. Income adds money. Expenses subtract money. Transfers subtract from their source and add to their destination.

Example, in rupees:

| Operation | Bank | Credit account | Expenses counted |
| --- | ---: | ---: | ---: |
| Opening balances | 10,000 | -200 | 0 |
| Salary +5,000 | 15,000 | -200 | 0 |
| Debit purchase 100 | 14,900 | -200 | 100 |
| Credit purchase 300 | 14,900 | -500 | 400 |
| Repay card 400 | 14,500 | -100 | 400 |

The repayment does not count as another expense. The future UI should label a negative credit balance as an amount owed, and a positive credit balance as a credit balance. Negative bank balances and credit overpayments are allowed; the application records financial reality rather than silently rejecting it as insufficient funds.

Opening balances are not income or expenses. Balances are derived from opening amounts and transaction history, rather than keeping a second balance field that can drift out of sync.

## What a repository does

A repository is a small layer that gives the UI meaningful operations instead of raw SQL. It currently exposes:

- `createAccount`, `createDebitCard`, `createCategory`, `createIncomeSource`
- `account` and `balance`
- `record` for income, expenses and transfers
- `spending` for monthly totals grouped under parent categories

Future forms call these operations. Values are passed to SQL through `?` parameters, so an apostrophe in an account name remains data rather than becoming part of a SQL command. Fixed schema statements use `execSync`; user values never get concatenated into those statements.

A discriminated TypeScript union describes the three transaction forms. An expense requires a category, income requires a source, and a transfer requires a destination. Runtime validation and database constraints still protect the actual records; TypeScript alone cannot validate user input or an imported backup.

## Atomic operations: save all or save nothing

`atomic` starts a SQLite transaction, performs the operation, and commits it. If anything fails, it rolls back.

A transfer is represented by one row with both account IDs. Saving it checks the resulting balances before committing. If the destination would exceed safe numeric limits, the entire operation is rolled back; the source does not lose money. A database constraint rejects transfers back to the same account.

The card/account foreign key prevents a debit card linked to Bank A from being used to charge Bank B. Foreign keys are enabled on the database connection.

## Migrations: evolving storage without losing records

A migration changes the database structure as the app evolves. `PRAGMA user_version` stores its version. Version 0 is initialized inside a transaction; version 1 is left intact. Opening it again does not recreate tables or remove records. A database from a newer application version is rejected instead of reset.

Later releases will add explicit version 1 -> 2 steps. We must never use "delete the database and recreate it" as an upgrade strategy for user records.

WAL (write-ahead logging) is enabled. It is a SQLite mode that helps reads and writes coexist; it does not upload anything. SQLite's supporting files stay in the app's local storage.

## Startup and failure behavior

DatabaseProvider opens the file asynchronously, runs initialization, then renders the app with a repository in React context. The `useRepository` hook lets future components obtain it. While opening, the app shows a loading message. If opening or migration fails, it offers Try again without deleting records.

The repository's small operations currently use synchronous SQLite calls to keep each transaction uninterrupted on the JavaScript thread. These calls can block rendering if work becomes large. Before large imports, long histories or complex reporting, move to bounded queries and asynchronous transactions. The current tests are correctness tests, not performance benchmarks.

The effect cleanup closes its connection. If opening completes after the component is removed, it closes that connection instead of updating an unmounted component.

## Verification

Run:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build:android
```

The storage tests run the same repository and schema against Node's built-in SQLite, using a small adapter for its differently named methods/results. They are not mocked SQL tests. One test writes a temporary database file, closes it, reopens it, and verifies the saved opening balance and name. Temporary test data is removed afterward.

Tests also cover PKR precision limits, migration repeatability, rejection of newer schemas, foreign keys, invalid dates, account/card links, transfer rollback, parent-category totals, month boundaries, and repayments not doubling expenses. Node's SQLite engine is separate from the phone's native engine: passing these tests does not by itself prove Android startup, so the native build/device evidence is recorded separately below.

The owner confirmed the previous milestone's month arrows, shared month selection, and expense-modal Back behavior on 2026-09-30. iOS is still untested.

## Next checkpoint

Build account/category/income-source forms first, then expense/income/transfer forms. Wire these to the repository and replace the sample screens with saved-record queries. Verify saved records after an actual app restart on Android. Then implement monthly plans and copying a past plan.

Reference: [Expo SQLite documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/).

### Validation results — 2026-09-30

- All 11 tests passed (4 preview tests and 7 storage tests).
- Strict TypeScript checking passed.
- Android JavaScript bundle exported successfully (741 modules).
- Initial device verification was interrupted by disconnection; the successful follow-up is recorded below.
- Screens remain sample-only, and no financial fixtures are inserted into the device database.
- Native Android debug build passed in 5m 41s. Generated Expo module registration includes `expo.modules.sqlite.SQLiteModule`. APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

### Android device verification — 2026-09-30

The SQLite build installed successfully on the OnePlus 8T. Metro was restarted after becoming unresponsive. The app created `files/SQLite/budget.db` in its private application storage and reached Home. After force-stopping the app, an empty database snapshot (including its WAL) was inspected locally: schema version 1, all six expected tables, `integrity_check = ok`, and zero transactions. Reopening the app reached Home again with the existing database. This verifies native initialization and reopening; saving user records through forms remains a later milestone. The snapshot stays in ignored build output and is not committed.
