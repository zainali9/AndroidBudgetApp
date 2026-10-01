# Lesson 6: monthly budgets and editing categories

## What you can do now

Version 1.2.0 adds monthly spending plans, copying an earlier plan into a draft, and editing category names and parents. Everything still lives in the phone's SQLite database. There is no application server or new online account.

The Home pie chart still shows actual expenses for the selected month, immediately below **Your month at a glance**. Beneath it, compact budget bars show the largest allocations first. Transactions retain red expenses and green income.

## Plan your first month

1. Open **Budgets** and use the month arrows to select October 2026 (or the month you want).
2. Tap **Edit monthly plan**.
3. Enter a PKR limit for each top-level category you want to budget.
4. Tap **Save plan**.
5. Add expenses normally, selecting their category and payment account. Return to Home or Budgets to see the updated remaining amounts.

For example, a Food limit of PKR 20,000.00 and a Food / Groceries expense of PKR 2,500.00 leave PKR 17,500.00 for Food. Both expenses directly assigned to Food and expenses in its subcategories count toward that one limit.

A blank field means **no budget assigned**. Entering `0` means **an explicit zero limit**. These are intentionally different: spending in an unplanned category appears in **Spending without a budget**, while any spending against a zero limit appears as **Over budget**. To remove an allocation, clear its field and save. Removing an allocation does not remove expenses.

You can still record expenses after exceeding a limit. A budget helps track your plan; it does not block recording what actually happened. Overspending is shown in red, with the amount over the limit. The bar fills to 100%, and the text explains the excess rather than drawing a bar outside its container.

The summary's **Remaining in plan** covers planned categories only. Additional unbudgeted spending is listed separately so it cannot silently consume a different category's allocation. Different categories' under- and overspending are netted in the summary, while each row retains its own remaining/over amount.

## Reuse a past plan

1. Select the destination month and open its plan editor.
2. If an earlier month has allocations, it appears under **Copy from a past month**.
3. Select that month and tap **Copy into draft**.
4. If the draft already contains amounts, confirm **Replace draft**.
5. Adjust any copied amounts, then tap **Save plan**.

Copying changes the fields in the form first. Until Save, the existing database plan is untouched. Cancel or Android Back asks whether to discard changed fields. The source month remains unchanged after saving.

Only planned allocations are copied. Expenses, account balances, and unused money are not copied. This is a reusable monthly plan, not automatic rollover of a remaining balance. A source allocation that was blank remains unassigned; a zero allocation remains zero. Copy replaces the destination draft rather than merging it with old amounts, so categories absent from the source become blank.

Only months before the selected destination month appear in the list, ordered newest first. A month with no saved allocations is not a copy source.

## Edit categories and their parents

Go to **Settings → Expense categories**, then tap **Edit** beside the category's name.

- Change the name to rename a category or parent category.
- Choose another top-level category to move a subcategory.
- Choose **None (top-level)** to promote a subcategory.
- Save. Changing the parent asks for confirmation because it also regroups historical spending.

Each category has a numeric ID. Transactions refer to that ID, not a copy of its name. Renaming updates the name attached to the same ID, keeping all expenses linked. Past transaction labels therefore show the new name too.

For example, moving Groceries from Food to Household means existing Groceries expenses now contribute to Household in every month. Their amounts, dates, and account balances stay the same. Previously assigned budget amounts remain attached to their original top-level categories; review affected monthly plans after moving a subcategory.

There is one subcategory level. A category cannot be its own parent, use a child as a parent, or create a cycle. To move a top-level category that has children, first move or promote its children. To move a top-level category with saved budget allocations, first clear those allocations in the months listed by the error. Even a zero allocation counts as a saved plan. These checks prevent hidden nested categories and allocations attached to a category that is no longer eligible for a top-level budget.

Renaming a parent does not require removing its children or budgets. Category deletion, merging, and archiving are outside this milestone.

## Why remaining is calculated instead of stored

The database stores two separate kinds of facts:

| Record | Example |
| --- | --- |
| Budget allocation | October / Food / 2,000,000 paisa |
| Expense transaction | October 1 / Groceries / 250,000 paisa |

The dashboard derives:

```text
remaining = planned amount - total expenses in the category for that month
```

There is no separate remaining-balance column to keep synchronized. Editing an expense, moving its date, deleting it, or changing its category automatically affects the next calculation. Income and transfers do not count as expenses, including repayments to a credit card. The purchase was the expense; repayment does not spend the same budget twice.

Amounts remain integer paisa. Input `2500.50` becomes `250050`; only display formatting converts it to a PKR string. Stored amounts and monthly totals are checked against JavaScript's safe integer range, including restored plans.

## Follow the React data flow

1. `App.tsx` reads the selected month's transactions, spending, and allocations through the repository.
2. It passes those values as **props** to the screens and progress component. Props are the inputs a parent component gives a child.
3. Opening an editor creates a **Modal**, an overlay with its own form and Android Back behavior.
4. Each text input is **controlled**: its value comes from React state, and typing calls a setter to update that state.
5. Save validates the draft and calls a repository method.
6. The success callback closes the modal and increments `revision`. This changes a dependency of `useMemo`, causing the shared screen data to be read again.

`useState` stores values that affect the screen, such as the draft fields. `useRef` stores the starting snapshot and a duplicate-save guard without triggering a render each time it changes. Comparing current fields to the starting snapshot tells the modal whether Cancel should ask about unsaved changes.

The copy action also updates draft state; it does not immediately write to SQLite. This gives you a chance to inspect and adjust a reused plan before saving it.

## How SQLite protects a plan update

`budget_plans` already existed in schema version 1, so no schema migration or database reset is needed. Its composite primary key is `(month, category_id)`: one category can have one allocation in each month, and independent allocations in other months.

`saveBudget` validates the month, category IDs, nonnegative integer amounts, duplicate categories, and total. It replaces that month's allocations inside a SQLite transaction. Here, a **SQLite transaction** means an all-or-nothing group of database operations; it is different from an expense transaction in the app.

If anything fails, SQLite rolls back. You do not get half of the old plan and half of the new one. Saving one month does not modify another month, any account, or an expense. Category updates also run atomically. Backup export already includes budget rows, and restore now additionally validates each month's total allocation.

## Files to read

| File | Responsibility |
| --- | --- |
| `src/data/storage.ts` | Category updates, plan queries/saves/copy helper, and restore validation |
| `src/screens/PlanningForms.tsx` | Budget draft, past-month selection, category editing, confirmations |
| `src/components/BudgetProgress.tsx` | Compact bars, remaining/over amounts, unbudgeted spending |
| `src/screens/BudgetScreens.tsx` | Screen layout and buttons opening the new editors |
| `App.tsx` | Shared data snapshot, modal state, refresh after saving |
| `tests/storage.test.mjs` | Real SQLite tests for these rules and earlier financial behavior |
| `app.json` | Android update version 1.2.0 / versionCode 3 |

## Verification and your phone checklist

The automated suite now has 24 passing tests. New cases cover blank versus zero allocation, invalid saves and overflow rollback, copying without duplicating expenses, moving an expense between months, category renaming/reparenting/promotion with stable IDs, rejected category cycles/depth/unsafe moves, and rejection of overflowing restored plan totals. Strict TypeScript checking passes.

These tests use real SQLite on the PC. They verify storage and calculations, but do not prove that the Android keyboard, layout, or confirmation dialogs work on a phone. Device verification status is recorded below.

After installing the update, try this with your intended real plan:

1. Save this month's allocations; close and reopen the app to check persistence.
2. Record an actual expense and confirm its category's remaining amount decreases.
3. Check that your credit-card repayment does not reduce the budget again.
4. Rename a category and confirm the existing expense label changes.
5. Open a parent change and cancel its confirmation if you do not want to regroup history.
6. Open next month's plan, copy this month's allocations, inspect the fields, and Cancel if you are not ready to save.
7. Export a fresh backup after making your intended changes.

## Build and installation

Run `npm.cmd run build:standalone` with Node, JDK 17, and the Android SDK configured. The output is `android/app/build/outputs/apk/release/app-release.apk`. It bundles the code and works independently of Metro.

Update using the existing package and signing key; do not uninstall or clear storage. The build script preserves the local signing key, and the database filename remains `budget.db`. Version 1.2.0 still uses schema and backup format version 1. Local build output, signing keys, and financial backups stay excluded from Git. iOS remains untested.

### Build verification — 2026-10-01

- All 24 tests passed; strict TypeScript checking passed.
- Android standalone release build succeeded in 7m 7s, including native compilation and release lint checks.
- APK signature verified. Package `com.zaina.budgetapp`, version 1.2.0 / code 3, ARM64, minimum API 24, target API 36. APK metadata did not report a debuggable flag.
- APK size: 30,318,285 bytes. Embedded JavaScript bundle: 1,526,872 bytes.
- Certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` matches the certificate verified for the previous installed version.
- The phone was disconnected throughout this milestone. Version 1.2.0 has not yet been installed or checked on-device. No phone records were changed; UI/keyboard/dialog checks remain pending.
- iOS remains untested. This remains a personal sideload APK using the preserved development key.
