import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BudgetRepository, migrate, parsePkr } from '../src/data/storage.ts';
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

