// SQLite storage for the local development API. Uses Node's built-in `node:sqlite`
// (Node 22.13+), so no extra packages are needed.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS transactions (
    id                  TEXT PRIMARY KEY,
    ord                 INTEGER NOT NULL,
    date                TEXT    NOT NULL,
    month               TEXT    NOT NULL,
    amount_cents        INTEGER NOT NULL,
    balance_after_cents INTEGER,
    account             TEXT    NOT NULL,
    counterparty_iban   TEXT    NOT NULL,
    counterparty_name   TEXT    NOT NULL,
    description         TEXT    NOT NULL,
    code                TEXT    NOT NULL,
    imported_at         TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS transactions_by_month ON transactions (month);

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

/** Money is stored in whole cents, so no rounding errors build up in the database. */
const toCents = (euros) => Math.round(euros * 100);
const toEuros = (cents) => Number(cents) / 100;

/**
 * @typedef {object} BankTransaction
 * @property {string} id
 * @property {number} order
 * @property {string} date
 * @property {string} month
 * @property {number} amount
 * @property {number | null} balanceAfter
 * @property {string} account
 * @property {string} counterpartyIban
 * @property {string} counterpartyName
 * @property {string} description
 * @property {string} code
 */

/**
 * Opens the database, creating the file, its folder and the tables when needed.
 * @param {string} file path of the database file, or `:memory:`
 */
export function openDatabase(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions
      (id, ord, date, month, amount_cents, balance_after_cents, account,
       counterparty_iban, counterparty_name, description, code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const selectAll = db.prepare('SELECT * FROM transactions ORDER BY ord, rowid');
  const count = db.prepare('SELECT COUNT(*) AS n FROM transactions');
  const deleteAll = db.prepare('DELETE FROM transactions');
  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const putSetting = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  return {
    file,

    /** @returns {BankTransaction[]} */
    listTransactions() {
      return selectAll.all().map((row) => ({
        id: row.id,
        order: Number(row.ord),
        date: row.date,
        month: row.month,
        amount: toEuros(row.amount_cents),
        balanceAfter: row.balance_after_cents === null ? null : toEuros(row.balance_after_cents),
        account: row.account,
        counterpartyIban: row.counterparty_iban,
        counterpartyName: row.counterparty_name,
        description: row.description,
        code: row.code,
      }));
    },

    /**
     * Inserts transactions in one database transaction; ids that exist already are skipped.
     * @param {readonly BankTransaction[]} transactions
     */
    addTransactions(transactions) {
      let added = 0;
      db.exec('BEGIN');
      try {
        for (const t of transactions) {
          const result = insert.run(
            t.id,
            t.order,
            t.date,
            t.month,
            toCents(t.amount),
            t.balanceAfter === null ? null : toCents(t.balanceAfter),
            t.account,
            t.counterpartyIban,
            t.counterpartyName,
            t.description,
            t.code,
          );
          added += Number(result.changes);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return { added, duplicates: transactions.length - added };
    },

    countTransactions() {
      return Number(count.get().n);
    },

    clearTransactions() {
      return Number(deleteAll.run().changes);
    },

    /** @returns {unknown} the stored settings object, or `null` when nothing is stored yet */
    readSettings() {
      const row = getSetting.get('settings');
      return row ? JSON.parse(row.value) : null;
    },

    /** @param {unknown} settings */
    writeSettings(settings) {
      putSetting.run('settings', JSON.stringify(settings));
    },

    close() {
      db.close();
    },
  };
}
