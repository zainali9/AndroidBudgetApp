      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
        kind TEXT NOT NULL CHECK(kind IN ('cash','bank','credit')),
        opening INTEGER NOT NULL CHECK(typeof(opening) = 'integer' AND opening BETWEEN -9007199254740991 AND 9007199254740991)
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
        amount INTEGER NOT NULL CHECK(typeof(amount) = 'integer' AND amount BETWEEN 1 AND 9007199254740991),
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
        amount INTEGER NOT NULL CHECK(typeof(amount) = 'integer' AND amount BETWEEN 0 AND 9007199254740991),
        PRIMARY KEY(month, category_id)
      );
      PRAGMA user_version = 1;
