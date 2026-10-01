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
function validBudgetMonth(month: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < '1900-01' || month > '9999-12') throw new Error('Choose a month between 1900 and 9999');
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
  previewOpeningBalance(id: number, opening: number): number {
    money(opening);
    const value = BigInt(this.balance(id)) - BigInt(this.account(id).opening) + BigInt(opening);
    if (value < -BigInt(MAX) || value > BigInt(MAX)) throw new Error('The corrected current balance would be too large');
    return Number(value);
  }
  updateAccount(id: number, name: string, opening: number): void {
    atomic(this.db, () => {
      this.account(id);
      this.db.runSync('UPDATE accounts SET name = ?, opening = ? WHERE id = ?', named(name), money(opening), id);
      // The correction must leave the derived current balance representable.
      this.balance(id);
    });
  }
  renameDebitCard(id: number, name: string): void {
    const result = this.db.runSync('UPDATE cards SET name = ? WHERE id = ?', named(name), id);
    if (!result.changes) throw new Error('Debit card no longer exists');
  }
  renameIncomeSource(id: number, name: string): void {
    const result = this.db.runSync('UPDATE income_sources SET name = ? WHERE id = ?', named(name), id);
    if (!result.changes) throw new Error('Income source no longer exists');
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
  updateCategory(id: number, name: string, parentId: number | null): void {
    atomic(this.db, () => {
      if (!this.categories().some(c => c.id === id)) throw new Error('Category no longer exists');
      if (parentId !== null) {
        const parent = this.categories().find(c => c.id === parentId);
        if (parentId === id || !parent || parent.parent_id !== null) throw new Error('Choose another top-level parent category');
        if (this.categories().some(c => c.parent_id === id)) throw new Error('Move this category’s subcategories first, then change its parent. Only one subcategory level is supported.');
        const plans = this.db.getAllSync<{ month: string }>('SELECT month FROM budget_plans WHERE category_id = ? ORDER BY month', id);
        if (plans.length) throw new Error('This category has budget allocations in ' + plans.map(p => p.month).join(', ') + '. Clear its allocation in those months before moving it under another category.');
      }
      this.db.runSync('UPDATE categories SET name = ?, parent_id = ? WHERE id = ?', named(name), parentId, id);
    });
  }
  budgetPlans(month: string): { categoryId: number; amount: number }[] {
    validBudgetMonth(month);
    return this.db.getAllSync<{ categoryId: number; amount: number }>('SELECT category_id AS categoryId, amount FROM budget_plans WHERE month = ? ORDER BY category_id', month);
  }
  budgetMonths(): string[] {
    return this.db.getAllSync<{ month: string }>('SELECT DISTINCT month FROM budget_plans ORDER BY month DESC').map(row => row.month);
  }
  saveBudget(month: string, plans: { categoryId: number; amount: number }[]): void {
    validBudgetMonth(month);
    atomic(this.db, () => {
      const roots = new Set(this.categories().filter(c => c.parent_id === null).map(c => c.id));
      const seen = new Set<number>();
      let total = 0;
      for (const plan of plans) {
        if (!roots.has(plan.categoryId) || seen.has(plan.categoryId)) throw new Error('Choose each top-level category only once');
        seen.add(plan.categoryId);
        if (money(plan.amount) < 0) throw new Error('Budget amounts cannot be negative');
        total = addMoney(total, plan.amount);
      }
      this.db.runSync('DELETE FROM budget_plans WHERE month = ?', month);
      for (const plan of plans) this.db.runSync('INSERT INTO budget_plans(month, category_id, amount) VALUES (?, ?, ?)', month, plan.categoryId, plan.amount);
    });
  }
  copyBudget(source: string, destination: string): void {
    validBudgetMonth(source); validBudgetMonth(destination);
    if (source >= destination) throw new Error('Choose a past month to copy');
    const plans = this.budgetPlans(source);
    if (!plans.length) throw new Error('That month has no saved plan');
    // saveBudget replaces allocations atomically; transactions are never copied.
    this.saveBudget(destination, plans);
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
  record(entry: Entry, id?: number): number {
    money(entry.amount);
    if (entry.amount <= 0) throw new Error('Amount must be greater than zero');
    dateOnly(entry.date);
    if ((entry.note ?? '').length > 500) throw new Error('Note must be 500 characters or fewer');
    return atomic(this.db, () => {
      this.account(entry.accountId);
      if (id !== undefined) this.entry(id);
      const parameters = [entry.kind, entry.amount, entry.date, entry.note ?? '', entry.accountId,
        entry.kind === 'transfer' ? entry.destinationId : null,
        entry.kind === 'expense' ? entry.categoryId : null,
        entry.kind === 'income' ? entry.sourceId : null,
        entry.kind === 'expense' ? entry.cardId ?? null : null];
      const result = id === undefined
        ? this.db.runSync(`INSERT INTO transactions(kind, amount, date, note, account_id, destination_id, category_id, source_id, card_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ...parameters)
        : this.db.runSync(`UPDATE transactions SET kind=?, amount=?, date=?, note=?, account_id=?, destination_id=?, category_id=?, source_id=?, card_id=? WHERE id=?`, ...parameters, id);
      this.validateBalances();
      this.balance(entry.accountId);
      if (entry.kind === 'transfer') this.balance(entry.destinationId);
      if (entry.kind === 'expense') this.spending(entry.date.slice(0, 7)).reduce((total, item) => addMoney(total, item.spent), 0);
      return id ?? result.lastInsertRowId;
    });
  }
  entry(id: number): Entry {
    const row = this.db.getFirstSync<{ kind: Entry['kind']; amount: number; date: string; note: string; account_id: number; destination_id: number; category_id: number; source_id: number; card_id: number | null }>('SELECT * FROM transactions WHERE id = ?', id);
    if (!row) throw new Error('Transaction no longer exists');
    const common = { amount: row.amount, date: row.date, note: row.note, accountId: row.account_id };
    if (row.kind === 'income') return { ...common, kind: row.kind, sourceId: row.source_id };
    if (row.kind === 'expense') return { ...common, kind: row.kind, categoryId: row.category_id, cardId: row.card_id ?? undefined };
    return { ...common, kind: row.kind, destinationId: row.destination_id };
  }
  deleteEntry(id: number): void {
    atomic(this.db, () => {
      this.entry(id);
      this.db.runSync('DELETE FROM transactions WHERE id = ?', id);
      this.validateBalances();
    });
  }
  private validateBalances(): void {
    for (const row of this.db.getAllSync<{ id: number }>('SELECT id FROM accounts')) this.balance(row.id);
  }
  exportBackup(): string {
    return atomic(this.db, () => JSON.stringify({ format: 'my-budget', version: 1, currency: 'PKR', createdAt: new Date().toISOString(),
      tables: Object.fromEntries(Object.keys(backupColumns).map(table => [table, this.db.getAllSync(`SELECT * FROM ${table}`)])) }, null, 2));
  }
  restoreBackup(text: string): void {
    const backup = parseBackup(text);
    atomic(this.db, () => {
      for (const table of ['transactions', 'budget_plans', 'cards', 'categories', 'income_sources', 'accounts']) {
        // Children must go first even when a parent category was created after its child in a backup.
        if (table === 'categories') this.db.runSync('DELETE FROM categories WHERE parent_id IS NOT NULL');
        this.db.execSync(`DELETE FROM ${table}`);
      }
      for (const [table, columns] of Object.entries(backupColumns)) {
        const rows = [...backup.tables[table]];
        if (table === 'categories') rows.sort((a, b) => Number(a.parent_id !== null) - Number(b.parent_id !== null));
        for (const row of rows) this.db.runSync(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, ...columns.map(column => row[column]));
      }
      for (const card of this.debitCards()) if (this.account(card.account_id).kind !== 'bank') throw new Error('Backup contains an invalid debit card');
      const categories = this.categories();
      for (const category of categories) if (category.parent_id !== null && categories.find(p => p.id === category.parent_id)?.parent_id !== null) throw new Error('Backup contains nested subcategories');
      for (const plan of backup.tables.budget_plans) if (categories.find(c => c.id === plan.category_id)?.parent_id !== null) throw new Error('Budget plans must use top-level categories');
      this.validateBalances();
      for (const month of this.budgetMonths()) this.budgetPlans(month).reduce((total, row) => addMoney(total, row.amount), 0);
      for (const { month } of this.db.getAllSync<{ month: string }>("SELECT DISTINCT substr(date,1,7) AS month FROM transactions")) this.spending(month).reduce((total, row) => addMoney(total, row.spent), 0);
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

export const BACKUP_LIMIT = 10 * 1024 * 1024;
const backupColumns: Record<string, string[]> = {
  accounts: ['id', 'name', 'kind', 'opening'],
  categories: ['id', 'name', 'parent_id'],
  income_sources: ['id', 'name'],
  cards: ['id', 'name', 'account_id'],
  transactions: ['id', 'kind', 'amount', 'date', 'note', 'account_id', 'destination_id', 'category_id', 'source_id', 'card_id'],
  budget_plans: ['month', 'category_id', 'amount'],
};
export type Backup = { tables: Record<string, Record<string, SqlValue>[]> };
export function parseBackup(text: string): Backup {
  if (text.length > BACKUP_LIMIT) throw new Error('Backup is larger than the 10 MB limit');
  // The file picker reports bytes, not JS UTF-16 length. Apply the same UTF-8 limit on export.
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes > BACKUP_LIMIT) throw new Error('Backup is larger than the 10 MB limit');
  }
  const data = JSON.parse(text);
  if (!data || data.format !== 'my-budget' || data.version !== 1 || data.currency !== 'PKR' || !data.tables) throw new Error('Unsupported backup format, version or currency');
  const tables: Backup['tables'] = {};
  let count = 0;
  for (const [table, columns] of Object.entries(backupColumns)) {
    const values = data.tables[table];
    if (!Array.isArray(values) || (count += values.length) > 20000) throw new Error('Backup is missing tables or exceeds 20,000 records');
    tables[table] = values.map((value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid backup record');
      const input = value as Record<string, unknown>;
      const row: Record<string, SqlValue> = {};
      for (const column of columns) {
        const field = input[column];
        const nullable = ['parent_id','destination_id','category_id','source_id','card_id'].includes(column) && !(table === 'budget_plans');
        if (field === null && nullable) { row[column] = null; continue; }
        if (['id','account_id','parent_id','destination_id','category_id','source_id','card_id','opening','amount'].includes(column)) {
          if (typeof field !== 'number' || !Number.isSafeInteger(field)) throw new Error('Invalid numeric value in backup');
          if (column !== 'opening' && (field < 0 || (field === 0 && !(table === 'budget_plans' && column === 'amount')))) throw new Error('Invalid positive amount or ID in backup');
        } else {
          if (typeof field !== 'string') throw new Error('Invalid text value in backup');
          if (column === 'name') named(field);
          if (column === 'note' && field.length > 500) throw new Error('Backup note is too long');
          if (column === 'date') dateOnly(field);
          if (column === 'month' && !/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/.test(field)) throw new Error('Invalid budget month');
          if (column === 'kind' && !(table === 'accounts' ? ['cash','bank','credit'] : ['income','expense','transfer']).includes(field)) throw new Error('Invalid record type');
        }
        row[column] = field as SqlValue;
      }
      return row;
    });
  }
  return { tables };
}
