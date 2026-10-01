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
    getAllSync: (sql, ...params) => sqlite.prepare(sql).all(...params),
    getFirstSync: (sql, ...params) => sqlite.prepare(sql).get(...params) ?? null,
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
