// This small interface lets the same repository run with Expo SQLite and real SQLite tests.
export type SqlValue = string | number | null;
export interface Database {
  execSync(sql: string): void;
  runSync(sql: string, ...params: SqlValue[]): { lastInsertRowId: number; changes: number };
  getAllSync<T>(sql: string, ...params: SqlValue[]): T[];
  getFirstSync<T>(sql: string, ...params: SqlValue[]): T | null;
}
export const SCHEMA_VERSION = 1;
const MAX = Number.MAX_SAFE_INTEGER;
export function money(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('Amount must be safe integer paisa');
  return value;
}
export function addMoney(left: number, right: number): number {
  return money(money(left) + money(right));
}
export function parsePkr(text: string): number {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) throw new Error('Enter rupees with up to two decimal places');
  const [whole, fraction = ''] = trimmed.split('.');
  const paisa = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (paisa > BigInt(MAX)) throw new Error('Amount is too large');
  return Number(paisa);
}
function named(value: string): string {
  const result = value.trim();
  if (!result || result.length > 100) throw new Error('Name must contain 1 to 100 characters');
  return result;
}
function dateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') throw new Error('Invalid date');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Invalid date');
  return value;
}
export function atomic<T>(db: Database, work: () => T): T {
  db.execSync('BEGIN IMMEDIATE');
  try { const result = work(); db.execSync('COMMIT'); return result; }
  catch (error) { db.execSync('ROLLBACK'); throw error; }
}
export function migrate(db: Database): void {
  db.execSync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  atomic(db, () => {
    const version = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')!.user_version;
    if (version > SCHEMA_VERSION) throw new Error('This database needs a newer app version');
    if (version === SCHEMA_VERSION) return;
    db.execSync(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
        kind TEXT NOT NULL CHECK(kind IN ('cash','bank','credit')),
        opening INTEGER NOT NULL CHECK(typeof(opening) = 'integer' AND opening BETWEEN -${MAX} AND ${MAX})
      );
      CREATE TABLE cards (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, account_id INTEGER NOT NULL REFERENCES accounts(id),
        UNIQUE(id, account_id)
      );
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, parent_id INTEGER REFERENCES categories(id), CHECK(parent_id IS NULL OR parent_id != id)
      );
      CREATE TABLE income_sources (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('income','expense','transfer')),
        amount INTEGER NOT NULL CHECK(typeof(amount) = 'integer' AND amount BETWEEN 1 AND ${MAX}),
        date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        destination_id INTEGER REFERENCES accounts(id),
        category_id INTEGER REFERENCES categories(id), source_id INTEGER REFERENCES income_sources(id),
        card_id INTEGER, FOREIGN KEY(card_id, account_id) REFERENCES cards(id, account_id),
        CHECK(
          (kind = 'income' AND source_id IS NOT NULL AND category_id IS NULL AND destination_id IS NULL AND card_id IS NULL) OR
          (kind = 'expense' AND category_id IS NOT NULL AND source_id IS NULL AND destination_id IS NULL) OR
          (kind = 'transfer' AND destination_id IS NOT NULL AND destination_id != account_id AND category_id IS NULL AND source_id IS NULL AND card_id IS NULL)
        )
      );
      CREATE INDEX transactions_date ON transactions(date);
      CREATE INDEX transactions_account ON transactions(account_id);
      CREATE INDEX transactions_destination ON transactions(destination_id);
      CREATE TABLE budget_plans (
        month TEXT NOT NULL, category_id INTEGER NOT NULL REFERENCES categories(id),
        amount INTEGER NOT NULL CHECK(typeof(amount) = 'integer' AND amount BETWEEN 0 AND ${MAX}),
        PRIMARY KEY(month, category_id)
      );
      PRAGMA user_version = 1;
    `);
  });
}
export type AccountKind = 'cash' | 'bank' | 'credit';
export type Account = { id: number; name: string; kind: AccountKind; opening: number };
export type Entry = { amount: number; date: string; accountId: number; note?: string } & (
  { kind: 'income'; sourceId: number } |
  { kind: 'expense'; categoryId: number; cardId?: number } |
  { kind: 'transfer'; destinationId: number }
);
type Row = { kind: Entry['kind']; amount: number; account_id: number; destination_id: number | null };
export type Category = { id: number; name: string; parent_id: number | null };
export type DebitCard = { id: number; name: string; account_id: number };
export type IncomeSource = { id: number; name: string };
export type SavedTransaction = { id: number; kind: Entry['kind']; amount: number; date: string; note: string; account: string; destination: string | null; category: string | null; source: string | null; card: string | null };
export function monthKey(month: number): string {
  if (!Number.isInteger(month) || month < 1900 * 12 || month > 9999 * 12 + 11) throw new Error('Choose a month between 1900 and 9999');
  return `${Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}`;
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export class BudgetRepository {
  accounts(): (Account & { balance: number })[] {
    return this.db.getAllSync<Account>('SELECT * FROM accounts ORDER BY id').map(account => ({ ...account, balance: this.balance(account.id) }));
  }
  categories(): Category[] { return this.db.getAllSync<Category>('SELECT * FROM categories ORDER BY id'); }
  debitCards(): DebitCard[] { return this.db.getAllSync<DebitCard>('SELECT * FROM cards ORDER BY id'); }
  incomeSources(): IncomeSource[] { return this.db.getAllSync<IncomeSource>('SELECT * FROM income_sources ORDER BY id'); }
  transactions(month: string): SavedTransaction[] {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month');
    return this.db.getAllSync<SavedTransaction>(`SELECT t.id, t.kind, t.amount, t.date, t.note, a.name AS account,
      d.name AS destination, CASE WHEN p.id IS NULL THEN c.name ELSE p.name || ' / ' || c.name END AS category,
      s.name AS source, card.name AS card
      FROM transactions t JOIN accounts a ON a.id = t.account_id
      LEFT JOIN accounts d ON d.id = t.destination_id LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN categories p ON p.id = c.parent_id LEFT JOIN income_sources s ON s.id = t.source_id
      LEFT JOIN cards card ON card.id = t.card_id
      WHERE t.date >= ? AND t.date <= ? ORDER BY t.date DESC, t.id DESC`, `${month}-01`, `${month}-31`);
  }
  readonly db: Database;
  constructor(db: Database) { this.db = db; }
  createAccount(name: string, kind: AccountKind, opening = 0): number {
    return this.db.runSync('INSERT INTO accounts(name, kind, opening) VALUES (?, ?, ?)', named(name), kind, money(opening)).lastInsertRowId;
  }
  createDebitCard(name: string, accountId: number): number {
    if (this.account(accountId).kind !== 'bank') throw new Error('A debit card must link to a bank account');
    return this.db.runSync('INSERT INTO cards(name, account_id) VALUES (?, ?)', named(name), accountId).lastInsertRowId;
  }
  createCategory(name: string, parentId: number | null = null): number {
    if (parentId !== null) {
      const parent = this.db.getFirstSync<{ parent_id: number | null }>('SELECT parent_id FROM categories WHERE id = ?', parentId);
      if (!parent || parent.parent_id !== null) throw new Error('Choose a top-level parent category');
    }
    return this.db.runSync('INSERT INTO categories(name, parent_id) VALUES (?, ?)', named(name), parentId).lastInsertRowId;
  }
  createIncomeSource(name: string): number {
    return this.db.runSync('INSERT INTO income_sources(name) VALUES (?)', named(name)).lastInsertRowId;
  }
  account(id: number): Account {
    const account = this.db.getFirstSync<Account>('SELECT * FROM accounts WHERE id = ?', id);
    if (!account) throw new Error('Account does not exist');
    return account;
  }
  balance(id: number): number {
    let value = BigInt(this.account(id).opening);
    const rows = this.db.getAllSync<Row>('SELECT kind, amount, account_id, destination_id FROM transactions WHERE account_id = ? OR destination_id = ?', id, id);
    for (const row of rows) {
      const positive = row.kind === 'income' || row.destination_id === id;
      value += (positive ? 1n : -1n) * BigInt(row.amount);
    }
    if (value < -BigInt(MAX) || value > BigInt(MAX)) throw new Error('Balance is too large');
    return Number(value);
  }
  record(entry: Entry): number {
    money(entry.amount);
    if (entry.amount <= 0) throw new Error('Amount must be greater than zero');
    dateOnly(entry.date);
    if ((entry.note ?? '').length > 500) throw new Error('Note must be 500 characters or fewer');
    return atomic(this.db, () => {
      this.account(entry.accountId);
      const result = this.db.runSync(`INSERT INTO transactions(kind, amount, date, note, account_id, destination_id, category_id, source_id, card_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, entry.kind, entry.amount, entry.date, entry.note ?? '', entry.accountId,
        entry.kind === 'transfer' ? entry.destinationId : null,
        entry.kind === 'expense' ? entry.categoryId : null,
        entry.kind === 'income' ? entry.sourceId : null,
        entry.kind === 'expense' ? entry.cardId ?? null : null);
      this.balance(entry.accountId);
      if (entry.kind === 'transfer') this.balance(entry.destinationId);
      if (entry.kind === 'expense') this.spending(entry.date.slice(0, 7)).reduce((total, item) => addMoney(total, item.spent), 0);
      return result.lastInsertRowId;
    });
  }
  spending(month: string): { categoryId: number; name: string; spent: number }[] {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month');
    const rows = this.db.getAllSync<{ categoryId: number; name: string; amount: number }>(`
      SELECT COALESCE(c.parent_id, c.id) AS categoryId, COALESCE(p.name, c.name) AS name, t.amount
      FROM transactions t JOIN categories c ON c.id = t.category_id LEFT JOIN categories p ON p.id = c.parent_id
      WHERE t.kind = 'expense' AND t.date >= ? AND t.date <= ? ORDER BY categoryId`, `${month}-01`, `${month}-31`);
    const totals = new Map<number, { categoryId: number; name: string; spent: number }>();
    for (const row of rows) {
      const previous = totals.get(row.categoryId)?.spent ?? 0;
      totals.set(row.categoryId, { categoryId: row.categoryId, name: row.name, spent: addMoney(previous, row.amount) });
    }
    return [...totals.values()];
  }
}
