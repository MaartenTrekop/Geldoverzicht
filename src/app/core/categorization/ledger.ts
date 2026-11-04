import {
  CASH,
  CategoryCatalog,
  INTERNAL_TRANSFER,
  OTHER_EXPENSE,
  OTHER_INCOME,
  SALARY,
  SAVINGS,
  createCategoryCatalog,
} from '../models/category';
import { Settings } from '../models/settings';
import { BankTransaction, Transaction } from '../models/transaction';
import { YearMonth } from '../period/months';
import { counterpartyKey, displayName, isOwnAccountTransfer } from './counterparty';
import { ATM_CODES, EXPENSE_RULES, INCOME_RULES } from './rules';

/** All transactions, interpreted with the user's settings. */
export interface Ledger {
  readonly transactions: readonly Transaction[];
  readonly catalog: CategoryCatalog;
  /** IBANs of accounts that appear in the imported exports. */
  readonly ownAccounts: ReadonlySet<string>;
  /** The account with the most transactions: the day-to-day account. */
  readonly mainAccount: string | null;
  /** Months that have at least one transaction, sorted. */
  readonly months: readonly YearMonth[];
}

interface Context {
  readonly ownAccounts: ReadonlySet<string>;
  readonly mainAccount: string | null;
}

/** Salary is recognised as regular income of at least this much from one counterparty. */
const SALARY_MINIMUM = 800;
const SALARY_MIN_MONTHS = 3;

/** The category the built-in rules give a transaction. */
export function autoCategory(tx: BankTransaction, context: Context): string {
  // Money moved between own accounts: on the main account it counts as saving; on the other
  // own accounts (whose exports show the same transfer again) it is internal, so it counts once.
  if (isOwnAccountTransfer(tx, context.ownAccounts)) {
    return !tx.account || tx.account === context.mainAccount ? SAVINGS : INTERNAL_TRANSFER;
  }
  const text = `${tx.counterpartyName} ${tx.description}`;
  if (ATM_CODES.includes(tx.code) || /geldautomaat/i.test(text)) {
    return tx.amount < 0 ? CASH : OTHER_INCOME;
  }
  if (tx.amount > 0) {
    const income = INCOME_RULES.find((r) => r.pattern.test(text));
    if (income) return income.category;
  }
  const expense = EXPENSE_RULES.find((r) => r.pattern.test(text));
  if (expense) return expense.category;
  return tx.amount > 0 ? OTHER_INCOME : OTHER_EXPENSE;
}

function mostFrequentAccount(transactions: readonly BankTransaction[]): string | null {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.account) counts.set(tx.account, (counts.get(tx.account) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [account, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) best = account;
  }
  return best;
}

/**
 * Unrecognised income that arrives from the same counterparty in at least three months
 * with a substantial average is almost always salary.
 */
function salaryKeys(
  entries: readonly { tx: BankTransaction; key: string; auto: string }[],
): Set<string> {
  const byKey = new Map<string, { months: Set<string>; total: number; count: number }>();
  for (const { tx, key, auto } of entries) {
    if (tx.amount <= 0 || auto !== OTHER_INCOME) continue;
    const entry = byKey.get(key) ?? { months: new Set<string>(), total: 0, count: 0 };
    entry.months.add(tx.month);
    entry.total += tx.amount;
    entry.count++;
    byKey.set(key, entry);
  }
  return new Set(
    [...byKey]
      .filter(([, e]) => e.months.size >= SALARY_MIN_MONTHS && e.total / e.count >= SALARY_MINIMUM)
      .map(([key]) => key),
  );
}

export function buildLedger(raw: readonly BankTransaction[], settings: Settings): Ledger {
  const catalog = createCategoryCatalog(settings.customCategories);
  const ownAccounts = new Set(raw.map((t) => t.account).filter(Boolean));
  const context: Context = { ownAccounts, mainAccount: mostFrequentAccount(raw) };

  const entries = raw.map((tx) => ({
    tx,
    key: counterpartyKey(tx, ownAccounts),
    auto: autoCategory(tx, context),
  }));
  const salary = salaryKeys(entries);

  const transactions = entries.map(({ tx, key, auto }): Transaction => {
    const autoCat = salary.has(key) && auto === OTHER_INCOME ? SALARY : auto;
    const chosen =
      settings.categoryByTransaction[tx.id] ?? settings.categoryByCounterparty[key] ?? autoCat;
    const category = catalog.has(chosen) ? chosen : autoCat;
    const owner =
      settings.ownerByTransaction[tx.id] ??
      settings.ownerByCounterparty[key] ??
      catalog.ownerOf(category) ??
      'shared';
    const overridden =
      tx.id in settings.categoryByTransaction ||
      key in settings.categoryByCounterparty ||
      tx.id in settings.ownerByTransaction ||
      key in settings.ownerByCounterparty;
    return {
      ...tx,
      key,
      displayName: displayName(tx, key, settings.accountNames),
      autoCategory: autoCat,
      category,
      owner,
      overridden,
    };
  });

  return {
    transactions,
    catalog,
    ownAccounts,
    mainAccount: context.mainAccount,
    months: [...new Set(raw.map((t) => t.month))].sort(),
  };
}
