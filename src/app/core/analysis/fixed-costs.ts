import { CategoryCatalog, VARIABLE_EXPENSES } from '../models/category';
import { Owner } from '../models/owner';
import { Transaction } from '../models/transaction';

/** A recurring payment with a constant amount, such as rent, insurance or a subscription. */
export interface FixedCost {
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly owner: Owner;
  /** Amount paid over the whole history. */
  readonly total: number;
  /** Total spread over all history months. */
  readonly perMonth: number;
  /** Most recent payment. */
  readonly typical: number;
  /** Number of months with a payment. */
  readonly monthsSeen: number;
  /** Paid in (nearly) every month, so it is expected again next month. */
  readonly monthly: boolean;
  /** The user said this is not a fixed cost. */
  readonly excluded: boolean;
}

/** A fixed cost as it applies to the period on screen. */
export interface FixedCostStatus extends FixedCost {
  /** Paid in the selected period. */
  readonly paid: number;
  /** Amount that counts for the budget: what was paid, or what is still expected. */
  readonly budgeted: number;
}

const MIN_MONTHS = 3;
/** Maximum payments per month: more often than that is not a fixed cost. */
const MAX_PAYMENTS_PER_MONTH = 1.3;
/** Maximum relative spread (coefficient of variation) of the individual payments. */
const MAX_VARIATION = 0.05;

function coefficientOfVariation(values: readonly number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return Infinity;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Finds counterparties that are paid the same amount, about once a month, in at least
 * three months of the history.
 */
export function detectFixedCosts(
  history: readonly Transaction[],
  historyMonths: number,
  catalog: CategoryCatalog,
  excluded: readonly string[] = [],
): FixedCost[] {
  const groups = new Map<
    string,
    {
      name: string;
      category: string;
      owner: Owner;
      months: Set<string>;
      payments: number[];
      last: Transaction;
    }
  >();
  for (const tx of history) {
    if (tx.amount >= 0 || catalog.kindOf(tx.category) !== 'expense') continue;
    if (VARIABLE_EXPENSES.includes(tx.category)) continue;
    const group = groups.get(tx.key) ?? {
      name: tx.displayName,
      category: tx.category,
      owner: tx.owner,
      months: new Set<string>(),
      payments: [],
      last: tx,
    };
    group.months.add(tx.month);
    group.payments.push(-tx.amount);
    if (tx.date > group.last.date || (tx.date === group.last.date && tx.order > group.last.order)) {
      group.last = tx;
    }
    group.category = group.last.category;
    group.owner = group.last.owner;
    groups.set(tx.key, group);
  }

  const result: FixedCost[] = [];
  for (const [key, g] of groups) {
    const monthsSeen = g.months.size;
    if (monthsSeen < MIN_MONTHS) continue;
    if (g.payments.length / monthsSeen > MAX_PAYMENTS_PER_MONTH) continue;
    if (coefficientOfVariation(g.payments) >= MAX_VARIATION) continue;
    const total = g.payments.reduce((a, b) => a + b, 0);
    result.push({
      key,
      name: g.name,
      category: g.category,
      owner: g.owner,
      total,
      perMonth: total / Math.max(1, historyMonths),
      typical: -g.last.amount,
      monthsSeen,
      monthly: monthsSeen >= Math.max(MIN_MONTHS, Math.round(historyMonths * 0.75)),
      excluded: excluded.includes(key),
    });
  }
  return result.sort((a, b) => b.perMonth - a.perMonth);
}

/**
 * How each fixed cost applies to the selected period. In month view a cost that has not been
 * paid yet still counts with its usual amount when it is a monthly cost.
 */
export function fixedCostStatus(
  fixedCosts: readonly FixedCost[],
  periodTransactions: readonly Transaction[],
  view: { readonly isMonth: boolean; readonly monthCount: number },
): FixedCostStatus[] {
  const paid = new Map<string, number>();
  for (const tx of periodTransactions) {
    if (tx.amount < 0) paid.set(tx.key, (paid.get(tx.key) ?? 0) - tx.amount);
  }
  return fixedCosts.map((cost) => {
    const amountPaid = paid.get(cost.key) ?? 0;
    const budgeted = view.isMonth
      ? amountPaid > 0
        ? amountPaid
        : cost.monthly
          ? cost.typical
          : 0
      : amountPaid / Math.max(1, view.monthCount);
    return { ...cost, paid: amountPaid, budgeted };
  });
}
