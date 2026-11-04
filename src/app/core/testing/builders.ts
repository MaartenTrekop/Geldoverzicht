import { BankTransaction, Transaction } from '../models/transaction';

/* Test data builders for the domain specs. */

let counter = 0;

export function bankTx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  const date = overrides.date ?? '2026-10-15';
  counter++;
  return {
    id: `tx-${counter}`,
    order: counter,
    date,
    month: date.slice(0, 7),
    amount: -10,
    balanceAfter: null,
    account: 'NL11RABO0123456789',
    counterpartyIban: '',
    counterpartyName: 'Winkel',
    description: '',
    code: 'bc',
    ...overrides,
  };
}

export function tx(overrides: Partial<Transaction> = {}): Transaction {
  const base = bankTx(overrides);
  return {
    ...base,
    key: overrides.key ?? base.counterpartyName.toLowerCase(),
    displayName: overrides.displayName ?? base.counterpartyName,
    autoCategory: overrides.autoCategory ?? overrides.category ?? 'Overig',
    category: overrides.category ?? 'Overig',
    owner: overrides.owner ?? 'shared',
    overridden: overrides.overridden ?? false,
  };
}

/** One transaction per month on the given day, for `months` (YYYY-MM) with the same fields. */
export function monthly(
  months: readonly string[],
  day: string,
  overrides: Partial<Transaction>,
): Transaction[] {
  return months.map((m) => tx({ ...overrides, date: `${m}-${day}` }));
}
