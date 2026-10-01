# Lesson 7: correcting accounts, cards, and income sources

## Why this is the next step

The original expense-entry and monthly-planning features are implemented. Before the Android test pass, this milestone fills a practical gap: correcting setup information after you have started using the app.

Version 1.3.0 adds account name/opening-balance edits, debit-card renaming, and income-source renaming. It includes the budget and category features from version 1.2.0. The two milestones have separate Git commits, but one installation of 1.3.0 contains both.

No new dependency, server, database table, or backup format is introduced. The app continues to use `budget.db`, schema version 1, and PKR integer paisa. Android remains the first test target; iOS testing comes later.

## Edit an account

Open **Accounts**, find the account, and tap **Edit account**. The form starts with its existing name, opening amount, and balance meaning.

The opening amount is the balance from before the transactions you have entered into this app. It is not today's bank balance. For a bank or cash account, select available money or a negative balance. For a credit card, select amount owed or credit in your favor.

The form shows:

- **Current balance:** the saved opening balance plus the effects of all saved transactions.
- **After saving:** the proposed balance if you save the new opening amount.

Changing only the name saves directly. Changing the numeric opening balance first shows a confirmation with the old opening balance, proposed opening balance, and resulting current balance. **Keep editing** returns to the form without saving; **Save correction** applies the change.

An empty amount is invalid in the edit form. Enter `0` explicitly to correct an opening balance to zero. Decimal input supports up to two places. The preview handles large signed amounts without rounding away paisa.

### Example

Suppose the app has:

| Item | Amount |
| --- | ---: |
| Saved opening balance | PKR 10,000.00 |
| Recorded expenses | PKR 2,000.00 |
| Current balance | PKR 8,000.00 |

If the opening balance was actually PKR 12,000.00, correcting it makes the current balance PKR 10,000.00. The expense total remains PKR 2,000.00, and the monthly budget's remaining amount is unchanged.

Use an opening correction to fix the original starting figure. Record salary as income, a purchase as an expense, and a card repayment as a transfer. Those are new financial events and belong in the transaction history.

For credit cards, an opening amount owed is stored as a negative value. Correcting the opening debt does not record a repayment. The preview labels a negative result as owed and a positive result as credit in your favor.

## Rename a debit card or income source

- In **Accounts**, a linked debit card has its own **Edit** button. Change its name and save.
- In **Settings → Income sources**, tap **Edit** beside a source, change its name, and save.

Existing transactions immediately display the new names. Their IDs and relationships are preserved; renaming does not recreate a card, account, source, or transaction.

Account type and a debit card's linked bank are displayed as fixed information. This editor does not convert a bank account into a credit card or move past debit-card purchases between banks. Those changes need a separate workflow because they affect the meaning or ownership of existing records.

Deletion and archiving of setup records are not included in this milestone.

## What React is doing

`SetupForm.tsx` handles three related forms. Its `target` prop uses a TypeScript **discriminated union**:

```ts
type SetupTarget =
  | { kind: 'account'; record: Account }
  | { kind: 'card'; record: DebitCard }
  | { kind: 'source'; record: IncomeSource };
```

Checking `target.kind` tells TypeScript which record fields are available. For example, the account branch has an opening balance and the debit-card branch has an account ID. This catches mistakes during `npm.cmd run typecheck`.

`useState` holds draft name, amount, sign, and error text. A ref blocks duplicate save attempts, including while a correction confirmation is open. The current draft is compared with its initial values so Cancel or Android Back can ask before discarding unsaved changes.

The modal wrapper is now a shared component, `FormSheet.tsx`. Budget, category, and setup editors reuse its keyboard handling, scrolling, safe-area layout, and discard confirmation. Extracting an existing component into a shared file is a small refactor: the budget and category workflows retain their behavior while the new editor reuses the same structure.

After a successful save, `App.tsx` closes the modal and refreshes the shared snapshot. Accounts, transaction labels, and choices therefore use the updated records.

## What SQLite is doing

`updateAccount` executes an `UPDATE` on the existing account ID. It changes only name and opening balance. It runs inside an all-or-nothing SQLite transaction and validates the resulting balance before committing. If the final value cannot be represented safely, the database rolls back both the name and the amount.

Card and income-source renaming each use a single SQL update with bound parameters. Missing records cause an error rather than a misleading successful save. Names must contain 1 to 100 characters after trimming outer whitespace.

The opening preview is read-only:

```text
proposed current balance = saved current balance - old opening + new opening
```

The implementation uses `BigInt` for the intermediate calculation and checks the final result before converting to a number. This matters when changing a large negative opening into a large positive one: their difference can exceed the safe number range even when the final result is valid.

The preview does not save a record. The repository checks the actual balance again during the update. Existing transaction amounts, dates, categories, card links, and budget rows are untouched by a setup correction.

## Files changed

| File | Responsibility |
| --- | --- |
| `src/screens/SetupForm.tsx` | Setup draft, balance preview, confirmation, validation feedback |
| `src/components/FormSheet.tsx` | Shared modal and discard behavior |
| `src/screens/PlanningForms.tsx` | Reuses the extracted form sheet |
| `src/data/storage.ts` | Read-only balance preview, account update, card/source renaming |
| `src/screens/BudgetScreens.tsx` | Edit buttons in Accounts and Settings |
| `App.tsx` | Opens/closes the setup editor and refreshes data |
| `tests/storage.test.mjs` | Financial invariants, rollback, persistence, and backup coverage |
| `app.json` | Version 1.3.0 / Android versionCode 4 |

## Verification

All 28 automated tests pass, including the previous budget/category tests. The four new cases cover:

1. Renaming used setup records and correcting opening balances while preserving transaction IDs, relationships, expenses, and plans.
2. Invalid names, missing records, unsafe numeric inputs, and positive/negative balance overflow; rejected changes preserve existing data.
3. Exact previews across large signed corrections and zero credit balances.
4. Persistence after closing/reopening the database and after backup restoration.

TypeScript checking passes. Automated tests use real SQLite on the PC; Android keyboard, dialogs, layouts, and installed-app behavior still require the combined phone test. See [the combined test checklist](08-combined-android-test-checklist.md).

The phone is intentionally deferred because it is busy. No device access or installation is required to write code, run these tests, or build the APK. Build results are recorded below.

### Build verification — 2026-10-01

- All 28 automated tests and strict TypeScript checking passed.
- Standalone Android release build and release lint checks passed in 8m 12s.
- Verified package `com.zaina.budgetapp`, version 1.3.0 / versionCode 4, ARM64, minimum API 24 and target API 36. No debuggable flag was reported by APK metadata inspection.
- The APK includes a 1,534,140-byte JavaScript bundle; APK size is 30,325,553 bytes.
- Signature verification passed. Certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` matches the certificate verified for the previously installed app.
- APK: `android/app/build/outputs/apk/release/app-release.apk`. It includes both milestones and can be installed once for combined testing.
- No phone commands were run and no installation was attempted because the phone is busy. Device UI, keyboard, confirmation, and updated-app persistence checks remain pending. iOS remains untested.
- The APK remains a personal sideload build using the preserved local development key. APKs, signing keys, and financial records are excluded from the commit.

### OnePlus installation and smoke checks — 2026-10-01

- Installed version 1.3.0 / code 4 over version 1.1.0 / code 2 using an in-place update. Installed/update certificate comparison passed before installation; the APK signature was verified again when resuming after an approval-review usage-limit interruption.
- Exported a fresh backup before upgrading to `Documents/MyBudgetBackups`. Exported again after the checks. All six tables matched exactly: 3 accounts, 8 categories, 3 income sources, 1 debit card, 0 transactions, 0 budget allocations. Private copies are in ignored local build output and are not committed.
- Two standalone cold launches succeeded with no ADB reverse forwarding to Metro. The final screen is Home.
- Budget editor opened for October 2026 with 8 category fields. A temporary amount could be entered; Android Back showed discard confirmation; discarding kept the plan empty. Saving the already-empty plan also completed successfully through native SQLite.
- Category editor opened with its parent selector and cancelled without saving.
- Account editor showed opening input and balance preview. Changing the draft amount triggered the correction confirmation. Keep editing retained the draft; Cancel/Discard discarded it. The original data remained unchanged.
- Debit-card and income-source editors opened and cancelled. Saving existing values unchanged for an account, debit card, and income source completed and returned to their screens.
- One test expectation was corrected because the Settings heading was outside the scrolled viewport; this was a test-script assumption, not an app failure.
- Checks used Android accessibility UI snapshots. They do not establish visual color/layout correctness. Nonempty plan copying, saved category regrouping, and financial mutation scenarios remain for an isolated-data device session; their repository behavior is covered by the 28 passing desktop tests. iOS remains untested.
