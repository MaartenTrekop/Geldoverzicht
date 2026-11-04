import { CategoryCatalog } from '../models/category';
import { Owner } from '../models/owner';
import { Transaction } from '../models/transaction';
import { YearMonth } from '../period/months';

/** Money in, money out and money saved. `expenses` and `savings` are positive amounts. */
export interface FlowTotals {
  readonly income: number;
  readonly expenses: number;
  readonly savings: number;
}

export const ZERO_TOTALS: FlowTotals = { income: 0, expenses: 0, savings: 0 };

/** What is left after expenses and saving. */
export function leftover(totals: FlowTotals): number {
  return totals.income - totals.expenses - totals.savings;
}

export function sumTotals(list: readonly FlowTotals[]): FlowTotals {
  return list.reduce(
    (sum, t) => ({
      income: sum.income + t.income,
      expenses: sum.expenses + t.expenses,
      savings: sum.savings + t.savings,
    }),
    ZERO_TOTALS,
  );
}

export function averageTotals(list: readonly FlowTotals[]): FlowTotals | null {
  if (!list.length) return null;
  const sum = sumTotals(list);
  return {
    income: sum.income / list.length,
    expenses: sum.expenses / list.length,
    savings: sum.savings / list.length,
  };
}

/**
 * Totals per month. Refunds are netted against their category, so a returned
 * webshop order lowers expenses instead of counting as income.
 */
export function monthlyTotals(
  transactions: readonly Transaction[],
  months: readonly YearMonth[],
  catalog: CategoryCatalog,
): Map<YearMonth, FlowTotals> {
  const totals = new Map<YearMonth, { income: number; expenses: number; savings: number }>(
    months.map((m) => [m, { income: 0, expenses: 0, savings: 0 }]),
  );
  for (const tx of transactions) {
    const month = totals.get(tx.month);
    if (!month) continue;
    switch (catalog.kindOf(tx.category)) {
      case 'income':
        month.income += tx.amount;
        break;
      case 'expense':
        month.expenses -= tx.amount;
        break;
      case 'savings':
        month.savings -= tx.amount;
        break;
      case 'internal':
        break;
    }
  }
  return totals;
}

/** Signed sum per category (income positive, expenses negative); internal transfers left out. */
export function categoryTotals(
  transactions: readonly Transaction[],
  catalog: CategoryCatalog,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (catalog.kindOf(tx.category) === 'internal') continue;
    totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount);
  }
  return totals;
}

export interface CounterpartyTotal {
  readonly key: string;
  readonly name: string;
  readonly owner: Owner;
  readonly amount: number;
  readonly count: number;
}

/** Counterparties you spent the most on, as positive amounts. */
export function topExpenseCounterparties(
  transactions: readonly Transaction[],
  catalog: CategoryCatalog,
  limit = 8,
): CounterpartyTotal[] {
  const byKey = new Map<
    string,
    { key: string; name: string; owner: Owner; amount: number; count: number }
  >();
  for (const tx of transactions) {
    if (catalog.kindOf(tx.category) !== 'expense') continue;
    const entry = byKey.get(tx.key) ?? {
      key: tx.key,
      name: tx.displayName,
      owner: tx.owner,
      amount: 0,
      count: 0,
    };
    entry.amount -= tx.amount;
    entry.count++;
    byKey.set(tx.key, entry);
  }
  return [...byKey.values()].sort((a, b) => b.amount - a.amount).slice(0, limit);
}
