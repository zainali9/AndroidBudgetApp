# Lesson 4: forms and real saved records

## What you can do now

This milestone connects the interface to SQLite. The sample records no longer drive any screen. An empty database shows empty states and setup guidance.

- Accounts: add bank, cash and credit accounts with opening balances. Add named debit cards linked to bank accounts.
- Settings: add expense categories, optional subcategories, and multiple income sources.
- Home or Transactions: use + to record an expense with its account, optional linked debit card, category, amount, date and note.
- Transactions: add income, transfer money between accounts, or repay a credit card.
- Home: see actual monthly spending and a category pie directly under the heading.

Monthly budget limits and copying past plans are still the next milestone. Until then Home shows compact spending totals, and Budgets explains what is coming. We do not display fake budget allocations or progress percentages. Editing/deleting saved records and backup/restore are not yet implemented. Check entries before saving.

## A first-use walkthrough

1. Open Accounts and choose Add account. Enter a name, select Bank, Cash or Credit card, and enter the opening amount in rupees.
2. Check the opening balance meaning. For a credit card, Amount owed is selected by default. A credit in your favor is also supported. Bank accounts can have an overdraft/negative balance.
3. Add a debit card if needed. It must link to an existing bank account; it does not have a second balance.
4. In Settings, add a category such as Food. Add Groceries with Food as its parent if you want a subcategory.
5. Add income sources such as Salary or Freelance in Settings.
6. Tap +, select the payment account and category, enter an amount, review the date and save. A linked debit card can be selected after choosing its bank account. To record a credit-card purchase, choose that credit account directly.
7. To repay a card, choose Transfer / repay card in Transactions. Choose the bank as From account and the credit card as To account.

Forms start with today's local date, even if you were viewing another month. You can enter a date in `YYYY-MM-DD` format. Saving a transaction switches Transactions to that date's month so the entry is easy to locate. Accounts show the current balance across all recorded dates, rather than a selected month's closing balance.

## Where the code lives

| File | Responsibility |
| --- | --- |
| `src/components/FormControls.tsx` | Shared text fields, choice controls and buttons |
| `src/screens/EntryForm.tsx` | Seven form variants, draft state, validation, save and discard behavior |
| `src/screens/BudgetScreens.tsx` | Renders database records and empty states |
| `src/data/storage.ts` | Lists saved records and returns transaction descriptions and monthly spending |
| `App.tsx` | Owns active form/month/tab and refreshes screen data after saving |
| `tests/storage.test.mjs` | Checks saved labels, ordering, balance calculations, restart persistence and overflow rollback |

## Controlled inputs

```tsx
const [name, setName] = useState('');
<Field label="Name" value={name} onChange={setName} />
```

The input's value comes from React state. Typing calls `setName`, which changes that state and updates the input. This is a controlled input. Text is still a draft at this point: no database write occurs until Save.

Separate state variables hold amount, account, category, date and note. These are strings while the user edits them. On Save, `parsePkr` converts amount text to exact integer paisa, selections are converted to IDs, and the repository performs the write. Failed validation displays an error without clearing the draft.

The same EntryForm handles account, debit card, category, income source, expense, income and transfer creation. Its `kind` prop chooses which fields and repository operation apply. The Modal is removed after a successful save, so the next form starts fresh.

## Choices and dependent fields

Choice controls display selectable options and expose their selected state for accessibility. Accounts and categories are referenced by database IDs, even though the user sees names.

Changing an expense's payment account clears its debit-card selection. Only cards attached to that account are shown. A transfer's destination list excludes its source account. If the source changes to the selected destination, that destination is cleared. Repository constraints still validate these relationships: UI filtering alone is not enough.

If required setup data does not exist, the form explains where to create it. An expense needs an account and category; income needs an account and income source. A transfer needs two accounts.

## Saving and refreshing the screens

The flow is:

```text
Type into form -> validate -> repository write -> SQLite commit
             -> onSaved callback -> refresh screen data -> close form
```

`onSaved` is a callback passed from App to EntryForm. After a successful save, App increments a small `revision` counter. The shared snapshot uses `useMemo` with repository, month and revision as dependencies, so the counter change causes a fresh database read. All five screens receive the same updated snapshot through props.

The counter is only a refresh signal, not persisted financial data. SQLite remains the source of truth. Restarting the app rebuilds the snapshot from saved records.

`useRef` guards the Save handler immediately, preventing rapid repeated taps from inserting the same draft twice. Unlike a state setter, updating a ref is synchronous and does not need a new render. The guard is released if validation or saving fails.

## Back, Cancel and the keyboard

A clean form closes immediately. If draft values have changed, Back or Cancel asks whether to discard them. Keeping the draft returns to editing. Android first dismisses an open keyboard before handling the form's Back action.

Forms scroll and use KeyboardAvoidingView so lower fields and actions can be reached when the keyboard is visible. `keyboardShouldPersistTaps="handled"` lets form controls respond to taps while the keyboard is open. These controls need further iOS and large-text testing later.

## Reading real records

The repository now lists accounts, cards, categories and income sources. Its monthly transaction query joins the related tables to return readable account, source, category and card labels. Results sort by date descending, then ID descending for entries saved on the same date.

Monthly expense queries group a subcategory under its top-level parent. Transfers appear neutrally in Transactions and do not contribute to the expense chart. Expense amounts are red; income amounts are green. Credit balances below zero are shown as Amount owed; a positive credit balance is labeled Credit in your favor.

Categories use stable IDs as React keys, so two similarly named categories do not share a rendering identity. Chart colors are derived from the category ID and remain consistent across months.

## Validation and limits

- Names require 1–100 characters; transaction notes allow up to 500.
- Transaction amounts must be positive, exact paisa within safe numeric limits.
- Dates must be real calendar dates, such as rejecting February 30.
- Missing selections and a transfer to the same account are rejected.
- An expense that would make the monthly total unsafe to display is rolled back atomically.
- Database read errors show a retry action instead of substituting fake data.

The small repository queries are synchronous. They suit the current early-stage dataset, but large histories will need pagination and more efficient queries. Transaction lists currently render the selected month's records in a ScrollView.

## Checks

Run `npm.cmd test` and `npm.cmd run typecheck`. The 13 automated tests include real SQLite close/reopen checks for saved transaction labels, debit-card links, balances, deterministic ordering and month filtering. The Android JavaScript export also passed. This milestone adds no native library or schema version, so it uses the already-installed SQLite APK with updated JavaScript through Metro.

Device checks and their exact results are recorded below. Tests use a separate temporary database to keep test purchases out of your real budget file. The committed app always opens `budget.db`.

## Next milestone

Add monthly budget plans and copy planned amounts from past months. Restore progress bars using real planned amounts, including explicit handling of expenses with no assigned budget and spending above the plan. Saved-record correction and backup/restore remain later work.

### Verification results — 2026-09-30

- All 13 automated tests passed; TypeScript and Android JavaScript export passed.
- On OnePlus 8T: the real empty database displayed PKR 0.00 and setup guidance; a blank account name was rejected without saving.
- In a separate temporary device database, UI saves succeeded for a bank account (PKR 1,000 opening), a category, an income source, a linked debit card and a credit account (PKR 50 owed).
- A debit expense of PKR 100, income of PKR 200 and credit repayment of PKR 25 produced a PKR 1,075 bank balance, PKR 25 remaining credit debt and PKR 100 total expenses. The same values appeared after force-stopping and reopening the app.
- The app was switched back to `budget.db`, the temporary test database was removed, and the real empty Home screen was verified again. No test records were inserted into the real database.
- Checks used Android UI accessibility text and real SQLite tests. iOS, large-text layouts, full screen-reader behavior and saved-record editing are not verified by these checks.
