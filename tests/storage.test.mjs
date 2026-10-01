import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
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
  db.execSync('PRAGMA user_version = 2');
  assert.throws(() => migrate(db), /newer app/);
  assert.equal(repo.balance(id), 100);
  assert.equal(db.getFirstSync('PRAGMA user_version').user_version, 2);
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
    assert.equal(second.repo.categories().length, 2);
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
  repo.saveBudget('2026-10', [{ categoryId: food, amount: 0 }, { categoryId: travel, amount: 120000 }]);
  const before = repo.budgetPlans('2026-10');
  assert.deepEqual(before, [{ categoryId: food, amount: 0 }, { categoryId: travel, amount: 120000 }]);
  for (const plans of [
    [{ categoryId: child, amount: 1 }], [{ categoryId: 999, amount: 1 }],
    [{ categoryId: food, amount: -1 }], [{ categoryId: food, amount: 0.5 }],
    [{ categoryId: food, amount: 1 }, { categoryId: food, amount: 2 }],
    [{ categoryId: food, amount: Number.MAX_SAFE_INTEGER }, { categoryId: travel, amount: 1 }],
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
  repo.saveBudget('2026-09', [{ categoryId: food, amount: 10000 }]);
  repo.saveBudget('2026-10', [{ categoryId: travel, amount: 5000 }]);
  const entry = { kind: 'expense', amount: 12000, date: '2026-09-30', accountId: bank, categoryId: child };
  const id = repo.record(entry);
  const balance = repo.balance(bank);
  repo.copyBudget('2026-09', '2026-10');
  assert.equal(repo.balance(bank), balance);
  assert.equal(repo.transactions('2026-10').length, 0);
  assert.deepEqual(repo.budgetPlans('2026-10'), [{ categoryId: food, amount: 10000 }]);
  assert.equal(repo.spending('2026-09')[0].spent, 12000);
  repo.record({ ...entry, date: '2026-10-01' }, id);
  assert.deepEqual(repo.spending('2026-09'), []);
  assert.equal(repo.spending('2026-10')[0].spent, 12000);
  assert.equal(repo.budgetPlans('2026-10')[0].amount - repo.spending('2026-10')[0].spent, -2000);
  for (const source of ['2026-10', '2026-11', '2026-08']) assert.throws(() => repo.copyBudget(source, '2026-10'));
  assert.deepEqual(repo.budgetPlans('2026-10'), [{ categoryId: food, amount: 10000 }]);
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
  repo.saveBudget('2026-09', [{ categoryId: food, amount: 3000 }]);
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
