# Lesson 10: subcategory budgets and credit-card payment labels

Version 1.5.0 changes planning from parent limits to amounts on categories without children. It also gives credit-card repayments a category while keeping their financial meaning as transfers.

## How planning now works

Suppose Food contains Groceries and Dining. Enter PKR 12,000 for Groceries and PKR 3,000 for Dining. The editor shows Food total PKR 15,000 automatically. A category without children, such as Transport, still has its own editable amount.

SQLite saves only the amounts you entered: one row for Groceries and one for Dining. It does not also save a Food row. Saving both the children and their calculated parent would count the same allocation twice. `budgetPlans()` reads the saved allocations; `budgetTotals()` groups them by parent for Home and Budgets. The dashboard continues to show parent-level progress, including expenses recorded directly under that parent. The pie still contains expenses only.

All calculations use integer paisa. PKR 12.34 is stored as 1234. Blank fields mean no allocation; an explicit 0 means a zero limit. Saving validates individual amounts, duplicates, category relationships and the complete total, then replaces that month's plan in one database transaction. Invalid input rolls back the entire save.

## Existing plans are preserved

The update cannot know how you want an old parent limit distributed. It therefore leaves all existing monthly allocations unchanged. Home continues to show those limits. When you open the editor, each parent with an old allocation shows its previous amount beside the new child fields. Enter the distribution you want; saving asks you to confirm replacement of those previous limits. Blank children have no allocation after that save. Cancelling keeps the original plan.

The same rule applies when a category gains its first child, or when you copy an older parent-only plan. Copying into the editor changes a draft; it does not save or copy transactions. The low-level `copyBudget()` method rejects parent-only plans that need redistribution; the UI deliberately uses the draft flow so you can allocate them yourself.

## Credit-card repayments

Fresh installations and upgrades include Bills → Credit Card Payment. If those exact names already exist in the correct hierarchy, the migration reuses them.

When the destination of a transfer is a credit-card account, the repository assigns that subcategory automatically. Selecting a credit card as the **source** is not a repayment. Bank-to-bank and bank-to-cash transfers remain uncategorized. The transaction screen displays the payment category, and search and category filters can find it.

For example, buying groceries on credit creates an expense and increases the amount owed. Paying the card later reduces your bank balance and the amount owed. That payment is still a transfer: it does not add another expense, appear in the expense pie, or consume the expense budget again. A budget entered under Credit Card Payment is an allocation, but transfers do not spend it; a separate cash-flow or debt-payment budget would be a future feature.

Existing transfers into credit accounts receive the label during upgrade without changing their amount, date, ID or balance effect. Changing a saved transfer's destination to a non-credit account removes its repayment category. Default category names are editable like other categories; a later repayment recreates the requested default path if it has been renamed or moved. Previously saved rows retain their links until edited.

## Why the database has a migration

The old SQLite CHECK constraint prohibited categories on transfers. Schema version 2 rebuilds the transaction table with the updated constraint, copies the existing rows and recreates its indexes inside one atomic transaction. An error rolls the migration back. It never clears the app's data. Default categories are inserted and existing repayments are labeled in that same transaction. Reopening an already migrated database does not repeat the migration.

New backups use format version 2 because older applications cannot understand categorized transfers or child allocations. This app accepts version 1 and version 2 backups. Restoring a backup preserves its stored records rather than silently redistributing budgets. Older backups can contain unlabeled repayments; newly saved or edited repayments get the default label. Keep an old backup before updating; version 2 exports require the new app.

## Files to follow

- `src/data/storage.ts`: migration, allocation validation, parent totals, repayment categorization and backup compatibility.
- `src/screens/PlanningForms.tsx`: child inputs, calculated draft totals, legacy-limit guidance and confirmation.
- `App.tsx`: supplies calculated parent totals to the dashboard.
- `src/data/transactionFilters.ts`: category filtering also includes categorized repayments.
- `tests/fixtures/schema-v1.sql`: actual previous schema used to test upgrades.
- `tests/storage.test.mjs`: SQLite integration tests using disposable databases, never phone records.

React state holds the draft text. SQLite holds committed records. `useMemo` in the app recomputes the shared screen data after a successful save changes the revision counter. A calculated parent total is derived data: it can always be reconstructed from the saved child amounts.

## Verification

On 2026-10-05, TypeScript checking and all 36 desktop tests passed. Tests cover a real version-1 upgrade, repeat migration, default reuse, unchanged financial rows, preserved legacy budgets, child rollups, overflow rollback, copy/restore, repayment search/filtering and destination editing without double-counting. Android build and device results are recorded in Lesson 11.
