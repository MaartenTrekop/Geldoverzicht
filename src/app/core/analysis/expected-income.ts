import { CategoryCatalog } from '../models/category';
import { Owner } from '../models/owner';
import { Transaction } from '../models/transaction';
import { YearMonth } from '../period/months';

/** Regular income that has not come in yet this month, such as a salary paid on the 25th. */
export interface ExpectedIncome {
  readonly key: string;
  readonly name: string;
  readonly owner: Owner;
  /** Median monthly amount in previous months. */
  readonly amount: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Income sources that arrived in at least 75% of the previous months (minimum two)
 * but not yet in the current month.
 */
export function expectedIncome(
  history: readonly Transaction[],
  previousMonths: readonly YearMonth[],
  currentMonth: readonly Transaction[],
  catalog: CategoryCatalog,
): ExpectedIncome[] {
  if (previousMonths.length < 2) return [];
  const previous = new Set(previousMonths);
  const sources = new Map<
    string,
    { name: string; owner: Owner; perMonth: Map<YearMonth, number> }
  >();
  for (const tx of history) {
    if (tx.amount <= 0 || !previous.has(tx.month) || catalog.kindOf(tx.category) !== 'income')
      continue;
    const source = sources.get(tx.key) ?? {
      name: tx.displayName,
      owner: tx.owner,
      perMonth: new Map(),
    };
    source.perMonth.set(tx.month, (source.perMonth.get(tx.month) ?? 0) + tx.amount);
    source.owner = tx.owner;
    sources.set(tx.key, source);
  }

  const received = new Set(currentMonth.filter((t) => t.amount > 0).map((t) => t.key));
  const needed = Math.max(2, Math.round(previousMonths.length * 0.75));
  const result: ExpectedIncome[] = [];
  for (const [key, source] of sources) {
    if (received.has(key) || source.perMonth.size < needed) continue;
    result.push({
      key,
      name: source.name,
      owner: source.owner,
      amount: median([...source.perMonth.values()]),
    });
  }
  return result.sort((a, b) => b.amount - a.amount);
}
