import { filterTransactions, emptyTransactionFilters } from '../src/data/transactionFilters.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BudgetRepository, migrate, parsePkr, parseBackup } from '../src/data/storage.ts';
function open(path = ':memory:') {
  const sqlite = new DatabaseSync(path);
  const db = {
    execSync: sql => sqlite.exec(sql),
    runSync: (sql, ...params) => { const result = sqlite.prepare(sql).run(...params); return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) }; },
    getAllSync: (sql, ...params) => sqlite.prepare(sql).all(...params).map(row => ({ ...row })),
    getFirstSync: (sql, ...params) => ((row) => row ? { ...row } : null)(sqlite.prepare(sql).get(...params)),
  };
  return { sqlite, db, repo: new BudgetRepository(db) };
}
function setup(t) { const fixture = open(); t.after(() => fixture.sqlite.close()); migrate(fixture.db); return fixture; }
const date = '2026-09-30';
test('PKR input converts exactly and rejects ambiguous or unsafe input', () => {
  assert.equal(parsePkr('123.45'), 12345);
  assert.equal(parsePkr('0.01'), 1);
  assert.equal(parsePkr(' 12.3 '), 1230);
  assert.equal(parsePkr('90071992547409.91'), Number.MAX_SAFE_INTEGER);
  for (const text of ['', '-1', '1e3', '1,000', '1.001', 'NaN', '90071992547409.92']) assert.throws(() => parsePkr(text));
});
test('migration is repeatable and data survives close/reopen', t => {
  const directory = mkdtempSync(join(tmpdir(), 'budget-storage-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'test.db');
  const first = open(path);
  migrate(first.db);
  const id = first.repo.createAccount("Owner's bank", 'bank', 12345);
  migrate(first.db);
  first.sqlite.close();
  const second = open(path);
  try { migrate(second.db); assert.equal(second.repo.balance(id), 12345); assert.equal(second.repo.account(id).name, "Owner's bank"); }
  finally { second.sqlite.close(); }
});
test('newer databases are refused without deleting records or version', t => {
  const { db, repo } = setup(t);
  const id = repo.createAccount('Cash', 'cash', 100);
  db.execSync('PRAGMA user_version = 99');
  assert.throws(() => migrate(db), /newer app/);
  assert.equal(repo.balance(id), 100);
  assert.equal(db.getFirstSync('PRAGMA user_version').user_version, 99);
});
test('income, debit purchases, credit purchases and repayment reconcile', t => {
  const { repo } = setup(t);
  const bank = repo.createAccount('Bank', 'bank', 1000000);
  const card = repo.createDebitCard('Debit', bank);
  const credit = repo.createAccount('Credit', 'credit', -20000);
  const source = repo.createIncomeSource('Salary');
  const food = repo.createCategory('Food');
  const groceries = repo.createCategory('Groceries', food);
  repo.record({ kind: 'income', amount: 500000, date, accountId: bank, sourceId: source });
  repo.record({ kind: 'expense', amount: 10000, date, accountId: bank, categoryId: groceries, cardId: card });
  repo.record({ kind: 'expense', amount: 30000, date, accountId: credit, categoryId: food });
  repo.record({ kind: 'transfer', amount: 40000, date, accountId: bank, destinationId: credit });
  assert.equal(repo.balance(bank), 1450000);
  assert.equal(repo.balance(credit), -10000);
  assert.deepEqual(repo.spending('2026-09'), [{ categoryId: food, name: 'Food', spent: 40000 }]);
  assert.deepEqual(repo.spending('2026-10'), []);
});
test('invalid references and overflowing transfers roll back completely', t => {
  const { repo, db } = setup(t);
  const bank = repo.createAccount('Bank', 'bank', 100);
  const destination = repo.createAccount('Full', 'cash', Number.MAX_SAFE_INTEGER);
  assert.throws(() => repo.record({ kind: 'transfer', amount: 1, date, accountId: bank, destinationId: destination }), /too large/);
  assert.equal(repo.balance(bank), 100);
  assert.equal(db.getFirstSync('SELECT COUNT(*) AS count FROM transactions').count, 0);
  assert.throws(() => repo.record({ kind: 'transfer', amount: 1, date, accountId: bank, destinationId: bank }));
  assert.throws(() => repo.record({ kind: 'expense', amount: 1, date, accountId: bank, categoryId: 999 }));
  assert.throws(() => repo.createDebitCard('Invalid', destination));
});
test('cards cannot debit a different account; subcategories cannot nest twice', t => {
  const { repo } = setup(t);
  const bank = repo.createAccount('Bank', 'bank');
  const other = repo.createAccount('Other', 'bank');
  const card = repo.createDebitCard('Debit', bank);
  const parent = repo.createCategory('Food');
  const child = repo.createCategory('Dining', parent);
  assert.throws(() => repo.createCategory('Too deep', child));
  assert.throws(() => repo.record({ kind: 'expense', date, amount: 100, accountId: other, categoryId: parent, cardId: card }));
  assert.equal(repo.balance(other), 0);
});
test('dates and amounts validate before writing; spending excludes other months', t => {
  const { repo, db } = setup(t);
  const accountId = repo.createAccount('Cash', 'cash');
  const categoryId = repo.createCategory('Transport');
  const entry = { kind: 'expense', accountId, categoryId, amount: 100, date };
  for (const invalid of ['2026-02-30', '2026-13-01', '2026-9-01', 'bad']) assert.throws(() => repo.record({ ...entry, date: invalid }));
  for (const amount of [0, -1, 1.5, Infinity]) assert.throws(() => repo.record({ ...entry, amount }));
  assert.equal(db.getFirstSync('SELECT COUNT(*) AS count FROM transactions').count, 0);
  repo.record(entry);
  repo.record({ ...entry, date: '2026-10-01', amount: 250 });
  assert.equal(repo.spending('2026-09')[0].spent, 100);
  assert.equal(repo.spending('2026-10')[0].spent, 250);
});


test('saved entries reopen with labels, card links and deterministic monthly ordering', t => {
  const directory = mkdtempSync(join(tmpdir(), 'budget-entry-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'entries.db');
  const first = open(path);
  migrate(first.db);
  const bank = first.repo.createAccount('Bank', 'bank', 100000);
  const card = first.repo.createDebitCard('Daily debit', bank);
  const cash = first.repo.createAccount('Wallet', 'cash');
  const parent = first.repo.createCategory('Food');
  const child = first.repo.createCategory('Groceries', parent);
  const source = first.repo.createIncomeSource('Freelance');
  first.repo.record({ kind: 'expense', amount: 1250, date, accountId: bank, categoryId: child, cardId: card, note: "Owner's purchase" });
  first.repo.record({ kind: 'income', amount: 5000, date, accountId: bank, sourceId: source });
  first.repo.record({ kind: 'transfer', amount: 2000, date, accountId: bank, destinationId: cash });
  first.sqlite.close();
  const second = open(path);
  try {
    migrate(second.db);
    const rows = second.repo.transactions('2026-09');
    assert.deepEqual(rows.map(r => r.kind), ['transfer', 'income', 'expense']);
    assert.equal(rows[0].destination, 'Wallet');
    assert.equal(rows[1].source, 'Freelance');
    assert.equal(rows[2].category, 'Food / Groceries');
    assert.equal(rows[2].card, 'Daily debit');
    assert.equal(rows[2].note, "Owner's purchase");
    assert.equal(second.repo.accounts()[0].balance, 101750);
    assert.equal(second.repo.accounts()[1].balance, 2000);
    assert.equal(second.repo.categories().length, 4);
    assert.equal(second.repo.debitCards()[0].account_id, bank);
    assert.equal(second.repo.incomeSources()[0].name, 'Freelance');
    assert.deepEqual(second.repo.transactions('2026-10'), []);
  } finally { second.sqlite.close(); }
});
test('a monthly total that cannot be displayed safely is rejected atomically', t => {
  const { repo } = setup(t);
  const first = repo.createAccount('First', 'bank', Number.MAX_SAFE_INTEGER);
  const second = repo.createAccount('Second', 'bank', 100);
  const category = repo.createCategory('Large');
  const other = repo.createCategory('Other');
  repo.record({ kind: 'expense', amount: Number.MAX_SAFE_INTEGER, date, accountId: first, categoryId: category });
  assert.throws(() => repo.record({ kind: 'expense', amount: 1, date, accountId: second, categoryId: other }));
  assert.equal(repo.balance(second), 100);
  assert.equal(repo.transactions('2026-09').length, 1);
});

test('editing an expense changes its original row, account and month; delete reverses it', t => {
  const { repo } = setup(t);
  const bank = repo.createAccount('Bank', 'bank', 10000);
  const cash = repo.createAccount('Cash', 'cash', 5000);
  const category = repo.createCategory('Food');
  const id = repo.record({ kind: 'expense', amount: 1000, date, accountId: bank, categoryId: category });
  repo.record({ kind: 'expense', amount: 2500, date: '2026-10-01', accountId: cash, categoryId: category, note: 'Corrected' }, id);
  assert.equal(repo.balance(bank), 10000);
  assert.equal(repo.balance(cash), 2500);
  assert.equal(repo.transactions('2026-09').length, 0);
  assert.equal(repo.transactions('2026-10')[0].id, id);
  assert.equal(repo.entry(id).note, 'Corrected');
  repo.deleteEntry(id);
  assert.equal(repo.balance(cash), 5000);
  assert.equal(repo.spending('2026-10').length, 0);
  assert.throws(() => repo.deleteEntry(id));
});
test('invalid edits and unsafe deletion roll back and retain original records', t => {
  const { repo } = setup(t);
  const accountId = repo.createAccount('Debt', 'credit', -Number.MAX_SAFE_INTEGER);
  const sourceId = repo.createIncomeSource('Adjustment');
  const categoryId = repo.createCategory('Food');
  const id = repo.record({ kind: 'income', amount: 10, date, accountId, sourceId });
  repo.record({ kind: 'expense', amount: 10, date, accountId, categoryId });
  assert.throws(() => repo.deleteEntry(id));
  assert.throws(() => repo.record({ kind: 'income', amount: 1, date, accountId, sourceId }, id));
  assert.equal(repo.entry(id).amount, 10);
  assert.equal(repo.balance(accountId), -Number.MAX_SAFE_INTEGER);
});
test('deleting a credit repayment restores both balances without adding spending', t => {
  const { repo } = setup(t);
  const bank = repo.createAccount('Bank', 'bank', 50000);
  const credit = repo.createAccount('Credit', 'credit', -10000);
  const id = repo.record({ kind: 'transfer', amount: 4000, date, accountId: bank, destinationId: credit });
  repo.deleteEntry(id);
  assert.equal(repo.balance(bank), 50000);
  assert.equal(repo.balance(credit), -10000);
  assert.deepEqual(repo.spending('2026-09'), []);
});
test('backup roundtrip preserves all tables, IDs, balances and planned amounts', t => {
  const { repo, db } = setup(t);
  const bank = repo.createAccount('Bank', 'bank', 50000);
  const credit = repo.createAccount('Credit', 'credit', -1000);
  const card = repo.createDebitCard('Debit', bank);
  const parent = repo.createCategory('Food');
  const child = repo.createCategory('Groceries', parent);
  repo.createIncomeSource('Salary');
  repo.record({ kind: 'expense', amount: 125, date, accountId: bank, categoryId: child, cardId: card });
  repo.record({ kind: 'transfer', amount: 200, date, accountId: bank, destinationId: credit });
  db.runSync('INSERT INTO budget_plans(month, category_id, amount) VALUES (?, ?, ?)', '2026-09', parent, 10000);
  const backup = repo.exportBackup();
  const target = open(); t.after(() => target.sqlite.close()); migrate(target.db);
  target.repo.createAccount('Will be replaced', 'cash');
  target.repo.restoreBackup(backup);
  assert.deepEqual(JSON.parse(target.repo.exportBackup()).tables, JSON.parse(backup).tables);
  assert.equal(target.repo.balance(bank), 49675);
  assert.equal(target.repo.balance(credit), -800);
  target.repo.restoreBackup(backup);
  assert.equal(target.repo.transactions('2026-09').length, 2);
});
test('malformed, incompatible and relationally invalid backups never replace current data', t => {
  const { repo } = setup(t);
  const id = repo.createAccount('Keep me', 'cash', 123);
  const original = JSON.parse(repo.exportBackup());
  const broken = [null, { ...original, version: 99 }, { ...original, currency: 'USD' }, { ...original, tables: {} }];
  const invalidCard = structuredClone(original);
  invalidCard.tables.cards.push({ id: 1, name: 'Wrong bank', account_id: id });
  broken.push(invalidCard);
  const missingReference = structuredClone(original);
  missingReference.tables.transactions.push({ id: 1, kind: 'expense', amount: 100, date, note: '', account_id: id, destination_id: null, category_id: 999, source_id: null, card_id: null });
  broken.push(missingReference);
  const duplicate = structuredClone(original); duplicate.tables.accounts.push(duplicate.tables.accounts[0]); broken.push(duplicate);
  const badDate = structuredClone(original);
  badDate.tables.transactions.push({ id: 1, kind: 'income', amount: 100, date: '2026-02-30', note: '', account_id: id, destination_id: null, category_id: null, source_id: 1, card_id: null });
  broken.push(badDate);
  for (const input of broken) {
    assert.throws(() => repo.restoreBackup(JSON.stringify(input)));
    assert.equal(repo.balance(id), 123);
    assert.deepEqual(JSON.parse(repo.exportBackup()).tables, original.tables);
  }
  assert.throws(() => repo.restoreBackup('{broken'));
});

test('backup size limit measures UTF-8 bytes consistently for multilingual text', () => {
  const text = '"' + '€'.repeat(3500000) + '"';
  assert.throws(() => parseBackup(text), /10 MB limit/);
});

test('monthly plans distinguish zero from unset, reject invalid saves atomically, and survive backup', t => {
  const { repo } = setup(t);
  const food = repo.createCategory('Food');
  const travel = repo.createCategory('Travel');
  const child = repo.createCategory('Groceries', food);
  repo.saveBudget('2026-10', [{ categoryId: child, amount: 0 }, { categoryId: travel, amount: 120000 }]);
  const before = repo.budgetPlans('2026-10');
  assert.deepEqual(before, [{ categoryId: travel, amount: 120000 }, { categoryId: child, amount: 0 }]);
  for (const plans of [
    [{ categoryId: food, amount: 1 }], [{ categoryId: 999, amount: 1 }],
    [{ categoryId: child, amount: -1 }], [{ categoryId: child, amount: 0.5 }],
    [{ categoryId: child, amount: 1 }, { categoryId: child, amount: 2 }],
    [{ categoryId: child, amount: Number.MAX_SAFE_INTEGER }, { categoryId: travel, amount: 1 }],
  ]) { assert.throws(() => repo.saveBudget('2026-10', plans)); assert.deepEqual(repo.budgetPlans('2026-10'), before); }
  for (const month of ['1899-12', '2026-00', '2026-13', '10000-01']) assert.throws(() => repo.saveBudget(month, []));
  const backup = repo.exportBackup();
  repo.saveBudget('2026-10', []);
  assert.deepEqual(repo.budgetMonths(), []);
  repo.restoreBackup(backup);
  assert.deepEqual(repo.budgetPlans('2026-10'), before);
});

test('copy replaces allocations only and expenses follow their date without mutating plans', t => {
  const { repo } = setup(t);
  const bank = repo.createAccount('Bank', 'bank', 1000000);
  const food = repo.createCategory('Food');
  const travel = repo.createCategory('Travel');
  const child = repo.createCategory('Groceries', food);
  repo.saveBudget('2026-09', [{ categoryId: child, amount: 10000 }]);
  repo.saveBudget('2026-10', [{ categoryId: travel, amount: 5000 }]);
  const entry = { kind: 'expense', amount: 12000, date: '2026-09-30', accountId: bank, categoryId: child };
  const id = repo.record(entry);
  const balance = repo.balance(bank);
  repo.copyBudget('2026-09', '2026-10');
  assert.equal(repo.balance(bank), balance);
  assert.equal(repo.transactions('2026-10').length, 0);
  assert.deepEqual(repo.budgetPlans('2026-10'), [{ categoryId: child, amount: 10000 }]);
  assert.equal(repo.spending('2026-09')[0].spent, 12000);
  repo.record({ ...entry, date: '2026-10-01' }, id);
  assert.deepEqual(repo.spending('2026-09'), []);
  assert.equal(repo.spending('2026-10')[0].spent, 12000);
  assert.equal(repo.budgetPlans('2026-10')[0].amount - repo.spending('2026-10')[0].spent, -2000);
  for (const source of ['2026-10', '2026-11', '2026-08']) assert.throws(() => repo.copyBudget(source, '2026-10'));
  assert.deepEqual(repo.budgetPlans('2026-10'), [{ categoryId: child, amount: 10000 }]);
  repo.deleteEntry(id);
  assert.deepEqual(repo.spending('2026-10'), []);
  assert.equal(repo.budgetPlans('2026-10')[0].amount, 10000);
});

test('renaming and moving categories preserve IDs, transactions, balances, and allocations', t => {
  const { repo } = setup(t);
  const bank = repo.createAccount('Bank', 'bank', 10000);
  const food = repo.createCategory('Food');
  const home = repo.createCategory('Home');
  const child = repo.createCategory('Groceries', food);
  const id = repo.record({ kind: 'expense', amount: 1000, date, accountId: bank, categoryId: child });
  repo.db.runSync('INSERT INTO budget_plans VALUES (?, ?, ?)', '2026-09', food, 3000);
  const entry = repo.entry(id);
  repo.updateCategory(food, 'Meals', null);
  assert.equal(repo.transactions('2026-09')[0].category, 'Meals / Groceries');
  repo.updateCategory(child, 'Weekly shop', home);
  assert.deepEqual(repo.spending('2026-09'), [{ categoryId: home, name: 'Home', spent: 1000 }]);
  assert.deepEqual(repo.entry(id), entry);
  assert.equal(repo.balance(bank), 9000);
  assert.deepEqual(repo.budgetPlans('2026-09'), [{ categoryId: food, amount: 3000 }]);
  repo.updateCategory(child, 'Weekly shop', null);
  assert.equal(repo.spending('2026-09')[0].categoryId, child);
  const backup = repo.exportBackup();
  repo.restoreBackup(backup);
  assert.deepEqual(repo.entry(id), entry);
});

test('invalid category edits roll back and budgeted parents cannot be silently demoted', t => {
  const { repo } = setup(t);
  const food = repo.createCategory('Food');
  const home = repo.createCategory('Home');
  const child = repo.createCategory('Groceries', food);
  const before = repo.categories();
  for (const [id, name, parent] of [[food, 'X', food], [food, 'X', child], [food, 'X', home], [child, 'X', 999], [child, ' ', home], [999, 'X', null]]) {
    assert.throws(() => repo.updateCategory(id, name, parent));
    assert.deepEqual(repo.categories(), before);
  }
  repo.updateCategory(child, 'Groceries', home);
  repo.saveBudget('2026-10', [{ categoryId: food, amount: 0 }]);
  assert.throws(() => repo.updateCategory(food, 'Moved', home), /2026-10/);
  assert.equal(repo.categories().find(c => c.id === food).name, 'Food');
  repo.saveBudget('2026-10', []);
  repo.updateCategory(food, 'Moved', home);
  assert.equal(repo.categories().find(c => c.id === food).parent_id, home);
});

test('restore rejects a budget total overflow without replacing existing records', t => {
  const { repo } = setup(t);
  const one = repo.createCategory('One');
  const two = repo.createCategory('Two');
  repo.saveBudget('2026-10', [{ categoryId: one, amount: 100 }]);
  const before = JSON.parse(repo.exportBackup()).tables;
  const backup = JSON.parse(repo.exportBackup());
  backup.tables.budget_plans = [
    { month: '2026-10', category_id: one, amount: Number.MAX_SAFE_INTEGER },
    { month: '2026-10', category_id: two, amount: 1 },
  ];
  assert.throws(() => repo.restoreBackup(JSON.stringify(backup)));
  assert.deepEqual(JSON.parse(repo.exportBackup()).tables, before);
});

test('setup renames retain links and opening corrections do not change expenses or plans', t => {
  const { repo } = setup(t);
  const bank = repo.createAccount('Bank', 'bank', 1000000);
  const credit = repo.createAccount('Credit', 'credit', -50000);
  const card = repo.createDebitCard('Debit', bank);
  const source = repo.createIncomeSource('Work');
  const category = repo.createCategory('Food');
  const expense = repo.record({ kind: 'expense', amount: 200000, date, accountId: bank, categoryId: category, cardId: card });
  const income = repo.record({ kind: 'income', amount: 10000, date, accountId: bank, sourceId: source });
  const transfer = repo.record({ kind: 'transfer', amount: 5000, date, accountId: bank, destinationId: credit });
  repo.saveBudget('2026-09', [{ categoryId: category, amount: 250000 }]);
  const entries = [expense, income, transfer].map(id => repo.entry(id));
  const spending = repo.spending('2026-09');
  const plans = repo.budgetPlans('2026-09');
  const oldBalance = repo.balance(bank);
  assert.equal(repo.previewOpeningBalance(bank, 1200000), oldBalance + 200000);
  assert.equal(repo.balance(bank), oldBalance, 'preview must not save');
  repo.updateAccount(bank, ' Main bank ', 1200000);
  repo.updateAccount(credit, 'Card account', -60000);
  repo.renameDebitCard(card, ' Daily debit ');
  repo.renameIncomeSource(source, ' Salary ');
  assert.deepEqual(repo.account(bank), { id: bank, name: 'Main bank', kind: 'bank', opening: 1200000 });
  assert.equal(repo.balance(bank), oldBalance + 200000);
  assert.equal(repo.balance(credit), -55000);
  assert.deepEqual([expense, income, transfer].map(id => repo.entry(id)), entries);
  assert.deepEqual(repo.spending('2026-09'), spending);
  assert.deepEqual(repo.budgetPlans('2026-09'), plans);
  const rows = repo.transactions('2026-09');
  assert.equal(rows.find(row => row.id === expense).account, 'Main bank');
  assert.equal(rows.find(row => row.id === expense).card, 'Daily debit');
  assert.equal(rows.find(row => row.id === income).source, 'Salary');
  assert.equal(rows.find(row => row.id === transfer).destination, 'Card account');
  assert.deepEqual(repo.debitCards(), [{ id: card, name: 'Daily debit', account_id: bank }]);
});

test('unsafe setup corrections roll back names and balances together', t => {
  const { repo } = setup(t);
  const bank = repo.createAccount('Bank', 'bank', 0);
  const category = repo.createCategory('Food');
  const source = repo.createIncomeSource('Work');
  const card = repo.createDebitCard('Debit', bank);
  repo.record({ kind: 'income', amount: 1, date, accountId: bank, sourceId: source });
  const before = JSON.parse(repo.exportBackup()).tables;
  for (const opening of [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 0.5, NaN, Infinity]) {
    assert.throws(() => repo.previewOpeningBalance(bank, opening));
    assert.throws(() => repo.updateAccount(bank, 'Should roll back', opening));
    assert.deepEqual(JSON.parse(repo.exportBackup()).tables, before);
  }
  for (const name of ['', '   ', 'x'.repeat(101)]) {
    assert.throws(() => repo.updateAccount(bank, name, 0));
    assert.throws(() => repo.renameDebitCard(card, name));
    assert.throws(() => repo.renameIncomeSource(source, name));
  }
  assert.throws(() => repo.updateAccount(999, 'Missing', 0));
  assert.throws(() => repo.renameDebitCard(999, 'Missing'));
  assert.throws(() => repo.renameIncomeSource(999, 'Missing'));
  assert.deepEqual(JSON.parse(repo.exportBackup()).tables, before);
  repo.record({ kind: 'expense', amount: 2, date, accountId: bank, categoryId: category });
  const negativeBefore = JSON.parse(repo.exportBackup()).tables;
  assert.throws(() => repo.updateAccount(bank, 'Too negative', -Number.MAX_SAFE_INTEGER));
  assert.deepEqual(JSON.parse(repo.exportBackup()).tables, negativeBefore);
});

test('opening preview handles large signed corrections exactly and zero credit balances', t => {
  const { repo } = setup(t);
  const credit = repo.createAccount('Credit', 'credit', -Number.MAX_SAFE_INTEGER);
  assert.equal(repo.previewOpeningBalance(credit, Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  assert.equal(repo.account(credit).opening, -Number.MAX_SAFE_INTEGER);
  repo.updateAccount(credit, 'Credit', Number.MAX_SAFE_INTEGER);
  assert.equal(repo.balance(credit), Number.MAX_SAFE_INTEGER);
  repo.updateAccount(credit, 'Credit', 0);
  assert.equal(repo.balance(credit), 0);
  assert.equal(repo.account(credit).kind, 'credit');
});

test('setup edits survive database reopen and a backup roundtrip', t => {
  const directory = mkdtempSync(join(tmpdir(), 'budget-setup-edits-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'setup.db');
  const first = open(path);
  migrate(first.db);
  const account = first.repo.createAccount('Before', 'bank', 0);
  const card = first.repo.createDebitCard('Before', account);
  const source = first.repo.createIncomeSource('Before');
  first.repo.updateAccount(account, 'Bank after', -12345);
  first.repo.renameDebitCard(card, 'Card after');
  first.repo.renameIncomeSource(source, 'Source after');
  const expected = JSON.parse(first.repo.exportBackup()).tables;
  first.sqlite.close();
  const second = open(path);
  try {
    migrate(second.db);
    assert.deepEqual(JSON.parse(second.repo.exportBackup()).tables, expected);
    const backup = second.repo.exportBackup();
    second.repo.updateAccount(account, 'Temporary', 100);
    second.repo.restoreBackup(backup);
    assert.deepEqual(JSON.parse(second.repo.exportBackup()).tables, expected);
    assert.equal(second.repo.balance(account), -12345);
  } finally { second.sqlite.close(); }
});

function transactionFilterFixture(t) {
  const { repo } = setup(t);
  const bank = repo.createAccount('Everyday', 'bank', 100000);
  const credit = repo.createAccount('Everyday', 'credit', 0);
  const food = repo.createCategory('Food');
  const groceries = repo.createCategory('Groceries', food);
  const travel = repo.createCategory('Travel');
  const source = repo.createIncomeSource('Salary');
  const card = repo.createDebitCard('Daily debit', bank);
  const common = { date: '2026-10-01', accountId: bank, amount: 100 };
  const direct = repo.record({ ...common, kind: 'expense', categoryId: food, note: 'Lunch sale 50% off', cardId: card });
  const child = repo.record({ ...common, kind: 'expense', categoryId: groceries, note: 'Weekly دودھ خریداری' });
  const other = repo.record({ ...common, kind: 'expense', accountId: credit, categoryId: travel, note: "Driver's fare" });
  const income = repo.record({ ...common, kind: 'income', sourceId: source });
  const transfer = repo.record({ ...common, kind: 'transfer', destinationId: credit });
  repo.record({ ...common, date: '2026-09-30', kind: 'expense', categoryId: food, note: 'Previous month' });
  const rows = repo.transactions('2026-10');
  const find = filters => filterTransactions(rows, { ...emptyTransactionFilters, ...filters }).map(row => row.id).sort((a, b) => a - b);
  return { repo, rows, find, bank, credit, food, groceries, travel, direct, child, other, income, transfer };
}

test('account filters use IDs and include both sides of transfers within the selected month', t => {
  const f = transactionFilterFixture(t);
  assert.deepEqual(f.find({ accountId: f.bank }), [f.direct, f.child, f.income, f.transfer]);
  assert.deepEqual(f.find({ accountId: f.credit }), [f.other, f.transfer]);
  assert.deepEqual(f.find({ kind: 'transfer', accountId: f.credit }), [f.transfer]);
  assert.deepEqual(f.find({ kind: 'income', accountId: f.credit }), []);
  assert.deepEqual(f.find({}), [f.direct, f.child, f.other, f.income, f.transfer]);
  assert.equal(f.rows.find(row => row.id === f.transfer).destinationId, f.credit);
});

test('parent category filters include direct and child expenses and combine with other filters', t => {
  const f = transactionFilterFixture(t);
  assert.deepEqual(f.find({ categoryId: f.food }), [f.direct, f.child]);
  assert.deepEqual(f.find({ categoryId: f.groceries }), [f.child]);
  assert.deepEqual(f.find({ kind: 'expense', accountId: f.credit, categoryId: f.food }), []);
  assert.deepEqual(f.find({ categoryId: f.food, query: 'weekly' }), [f.child]);
  assert.equal(f.rows.find(row => row.id === f.child).categoryParentId, f.food);
  assert.equal(f.rows.find(row => row.id === f.income).categoryId, null);
});

test('search handles case, multiple terms, Urdu, normalized text, dates, and literal punctuation', t => {
  const f = transactionFilterFixture(t);
  assert.deepEqual(f.find({ query: '  DAILY   lunch  ' }), [f.direct]);
  assert.deepEqual(f.find({ query: 'دودھ' }), [f.child]);
  assert.deepEqual(f.find({ query: 'ＳＡＬＡＲＹ' }), [f.income]);
  assert.deepEqual(f.find({ query: '2026-10-01', kind: 'income' }), [f.income]);
  assert.deepEqual(f.find({ query: '50%' }), [f.direct]);
  assert.deepEqual(f.find({ query: "driver's" }), [f.other]);
  assert.deepEqual(f.find({ query: '[' }), []);
  assert.deepEqual(f.find({ query: '   ' }), f.find({}));
  assert.deepEqual(f.find({ query: 'previous month' }), []);
});

test('filters preserve order and records and follow renamed or regrouped categories', t => {
  const f = transactionFilterFixture(t);
  const before = JSON.parse(f.repo.exportBackup()).tables;
  const rows = f.rows.map(row => Object.freeze({ ...row }));
  Object.freeze(rows);
  const result = filterTransactions(rows, Object.freeze({ ...emptyTransactionFilters, kind: 'expense' }));
  assert.deepEqual(result.map(row => row.id), [f.other, f.child, f.direct]);
  assert.deepEqual(JSON.parse(f.repo.exportBackup()).tables, before);
  f.repo.updateAccount(f.bank, 'Renamed bank', f.repo.account(f.bank).opening);
  f.repo.updateCategory(f.groceries, 'Milk', f.travel);
  const updated = f.repo.transactions('2026-10');
  assert.deepEqual(filterTransactions(updated, { ...emptyTransactionFilters, accountId: f.bank, categoryId: f.travel }).map(row => row.id), [f.child]);
  assert.deepEqual(filterTransactions(updated, { ...emptyTransactionFilters, query: 'milk renamed' }).map(row => row.id), [f.child]);
  assert.deepEqual(filterTransactions(updated, { ...emptyTransactionFilters, categoryId: f.food }).map(row => row.id), [f.direct]);
});


test('version 1 upgrade preserves ledger and legacy plans, reuses defaults, and labels repayments once', t => {
  const { db, repo, sqlite } = open(); t.after(() => sqlite.close());
  db.execSync('PRAGMA foreign_keys = ON');
  db.execSync(readFileSync(new URL('./fixtures/schema-v1.sql', import.meta.url), 'utf8'));
  const bank = repo.createAccount('Bank', 'bank', 100000);
  const credit = repo.createAccount('Credit', 'credit', -50000);
  const bills = repo.createCategory('Bills');
  const payment = repo.createCategory('Credit Card Payment', bills);
  db.runSync('INSERT INTO budget_plans VALUES (?, ?, ?)', '2026-10', bills, 30000);
  db.runSync("INSERT INTO transactions(kind, amount, date, account_id, destination_id) VALUES ('transfer', ?, ?, ?, ?)", 10000, '2026-10-01', bank, credit);
  const balances = repo.accounts();
  const before = JSON.parse(repo.exportBackup()).tables;
  migrate(db); migrate(db);
  assert.equal(db.getFirstSync('PRAGMA user_version').user_version, 2);
  assert.deepEqual(repo.accounts(), balances);
  assert.deepEqual(repo.categories(), before.categories);
  assert.deepEqual(repo.budgetPlans('2026-10'), [{ categoryId: bills, amount: 30000 }]);
  assert.deepEqual(repo.budgetTotals('2026-10'), [{ categoryId: bills, amount: 30000 }]);
  assert.equal(repo.transactions('2026-10')[0].categoryId, payment);
  assert.equal(repo.transactions('2026-10')[0].category, 'Bills / Credit Card Payment');
  assert.deepEqual(repo.spending('2026-10'), []);
  assert.deepEqual(db.getAllSync('PRAGMA foreign_key_check'), []);
  const upgraded = JSON.parse(repo.exportBackup()).tables;
  const expected = structuredClone(before); expected.transactions[0].category_id = payment;
  assert.deepEqual(upgraded, expected);
});

test('leaf allocations roll up exactly, copy and restore, with no stored parent duplication', t => {
  const { repo } = setup(t);
  const food = repo.createCategory('Food');
  const groceries = repo.createCategory('Groceries', food);
  const dining = repo.createCategory('Dining', food);
  const travel = repo.createCategory('Travel');
  repo.saveBudget('2026-09', [{ categoryId: groceries, amount: 120001 }, { categoryId: dining, amount: 29999 }, { categoryId: travel, amount: 0 }]);
  assert.deepEqual(repo.budgetTotals('2026-09'), [{ categoryId: food, amount: 150000 }, { categoryId: travel, amount: 0 }]);
  assert.ok(!repo.budgetPlans('2026-09').some(row => row.categoryId === food));
  const backup = repo.exportBackup(); repo.restoreBackup(backup);
  repo.copyBudget('2026-09', '2026-10');
  assert.deepEqual(repo.budgetTotals('2026-10'), repo.budgetTotals('2026-09'));
  const before = JSON.parse(repo.exportBackup()).tables;
  assert.throws(() => repo.saveBudget('2026-10', [{ categoryId: food, amount: 10 }, { categoryId: dining, amount: 10 }]));
  assert.deepEqual(JSON.parse(repo.exportBackup()).tables, before);
});

test('repayments are categorized and searchable without double-counting; editing destination removes the label', t => {
  const { repo } = setup(t);
  const bills = repo.categories().find(c => c.name === 'Bills');
  const payment = repo.categories().find(c => c.name === 'Credit Card Payment');
  assert.equal(payment.parent_id, bills.id);
  const bank = repo.createAccount('Bank', 'bank', 10000);
  const credit = repo.createAccount('Credit', 'credit', -10000);
  const cash = repo.createAccount('Cash', 'cash', 0);
  const entry = { kind: 'transfer', amount: 2000, accountId: bank, destinationId: credit, date: '2026-10-01' };
  const id = repo.record(entry);
  let rows = repo.transactions('2026-10');
  assert.equal(rows[0].categoryId, payment.id);
  assert.equal(filterTransactions(rows, { ...emptyTransactionFilters, categoryId: bills.id }).length, 1);
  assert.equal(filterTransactions(rows, { ...emptyTransactionFilters, query: 'credit card payment' }).length, 1);
  assert.deepEqual(repo.spending('2026-10'), []);
  assert.equal(repo.balance(bank), 8000); assert.equal(repo.balance(credit), -8000);
  const backup = repo.exportBackup(); assert.equal(JSON.parse(backup).version, 2);
  repo.restoreBackup(backup); assert.equal(repo.transactions('2026-10')[0].categoryId, payment.id);
  repo.record({ ...entry, destinationId: cash }, id);
  assert.equal(repo.transactions('2026-10')[0].categoryId, null);
  assert.equal(repo.balance(credit), -10000);
  repo.deleteEntry(id); assert.equal(repo.balance(bank), 10000); assert.equal(repo.balance(cash), 0);
});

test('old backups retain parent plans for redistribution and upgraded backups keep child plans', t => {
  const { repo } = setup(t);
  const parent = repo.createCategory('Food');
  const child = repo.createCategory('Groceries', parent);
  const old = JSON.parse(repo.exportBackup()); old.version = 1;
  old.tables.budget_plans = [{ month: '2026-10', category_id: parent, amount: 999 }];
  repo.restoreBackup(JSON.stringify(old));
  assert.deepEqual(repo.budgetTotals('2026-10'), [{ categoryId: parent, amount: 999 }]);
  const before = repo.exportBackup();
  assert.throws(() => repo.copyBudget('2026-10', '2026-11'));
  assert.deepEqual(repo.budgetPlans('2026-11'), []);
  repo.saveBudget('2026-10', [{ categoryId: child, amount: 999 }]);
  assert.deepEqual(repo.budgetTotals('2026-10'), [{ categoryId: parent, amount: 999 }]);
  repo.restoreBackup(before);
  assert.deepEqual(repo.budgetPlans('2026-10'), [{ categoryId: parent, amount: 999 }]);
});
