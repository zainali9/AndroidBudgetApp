# Combined Android test: budgets, categories, and setup corrections

Status: **Version 1.3.0 installed on the OnePlus 8T; smoke and unchanged-value save checks passed on 2026-10-01.** The pre/post-update exports match exactly. Unchecked scenarios below remain pending, particularly synthetic financial mutations and visual checks. See Lesson 7 for the detailed results.

## Versions and commits

- Version 1.2.0: monthly budgets, copying draft plans, category editing; commit `af7b6af`.
- Version 1.3.0: account opening/name corrections and card/source renaming; separate successor commit.
- Install the latest 1.3.0 APK once to test both. There is no need to install 1.2.0 first.

## Protect the daily-use app

- [x] Export a current backup before upgrading, since new records may have been entered after the last backup.
- [x] Check the new APK's package ID and signing certificate against the installed app.
- [x] Update in place using the same package/signing key. Do not uninstall or clear storage.
- [x] Cold-launch the app without Metro forwarding and confirm the existing records and balances are present.

Use the real app for read-only checks and intended corrections. Run synthetic save/delete/restore cases in an isolated test installation/database so test expenses do not enter the daily-use ledger. Do not replace the real database with fixture data. If an isolated test installation is unavailable, leave those mutation cases pending until the owner chooses real values to save.

## Budget and category checks

- [ ] Open Home: pie chart immediately below the heading; budget rows remain compact and scrollable.
- [x] Open Budgets and check selected month, editor values, keyboard scrolling, and Save/Cancel accessibility.
- [ ] In isolated data, save positive and zero limits while leaving one category blank; reopen and confirm all three states.
- [ ] Record an expense in a child category; confirm its parent budget decreases by the exact PKR amount.
- [ ] Check an overspent category: full bar, red over-budget amount; an unassigned category appears separately.
- [ ] Move an expense's date to another month and delete it; confirm spending follows the saved records while plan amounts stay fixed.
- [ ] Copy a previous month's plan into the destination draft; verify replacement confirmation, unchanged source, and no copied expenses.
- [ ] Cancel a changed draft using both the on-screen control and Android Back; discard confirmation must protect unsaved edits.
- [ ] Rename a used category and its parent; confirm updated labels without duplicate transactions.
- [ ] Change a subcategory parent: check the warning, cancel once, then confirm in isolated data and verify historical regrouping.
- [ ] Try moving a parent with children or budget allocations; check the actionable error and unchanged records.

## Setup correction checks

- [ ] Open each account type's editor: bank, cash, credit card; verify existing name, opening amount, and sign.
- [ ] Confirm the displayed current balance agrees with Accounts before any edits.
- [ ] In isolated data, correct a starting balance and verify the preview, confirmation, and resulting saved balance agree.
- [x] Cancel the opening-correction confirmation; verify the saved account is unchanged and the draft remains editable.
- [ ] Check credit debt, credit in your favor, zero, and a bank overdraft; confirm labels and signs are clear.
- [ ] Rename an account used by expenses, income, and transfers; transaction labels should refresh while IDs/amounts remain unchanged.
- [ ] Rename a used debit card and income source; verify transaction labels and future-entry choices refresh.
- [ ] Verify account type and debit-card bank link are fixed in these editors.
- [ ] Try blank/invalid opening input; remain in the editor with an error and keep existing records.
- [ ] Try Save twice quickly; one correction should be applied without duplicate dialogs/writes.

## Combined regression checks

- [ ] Record a credit-card purchase and repayment in isolated data; only the purchase reduces the expense budget.
- [ ] Correct that card's opening balance; debt changes but expenses and budget remaining do not.
- [ ] Reopen the app and confirm edited setup records and plans persist.
- [ ] Export a fresh backup with both kinds of changes. On isolated data, restore and compare records/plans/balances.
- [ ] Check light/dark appearance, long names, keyboard visibility, larger system text, and Android Back behavior.
- [x] Leave the daily-use app on Home with the owner's intended data and a fresh backup.

Record actual outcomes and any fixes after the session. iOS validation remains a later milestone after Android verification.
