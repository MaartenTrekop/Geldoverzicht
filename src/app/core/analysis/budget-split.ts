import { CategoryCatalog } from '../models/category';
import { OWNERS, Owner } from '../models/owner';
import { SavingsPot, SplitLine, SplitMode, SplitPlan } from '../models/settings';
import { Transaction } from '../models/transaction';
import { ExpectedIncome } from './expected-income';
import { FixedCostStatus } from './fixed-costs';

export interface CategoryAmount {
  readonly name: string;
  readonly amount: number;
}

export interface SplitLineResult {
  readonly line: SplitLine;
  /** The value the user set: a percentage or an amount, depending on the plan's mode. */
  readonly value: number;
  readonly planned: number;
  readonly actual: number;
  /** What a partner spent their own money on (empty for the savings line). */
  readonly categories: readonly CategoryAmount[];
}

/** Monthly budget: income − shared fixed costs − household budget = free, split over three lines. */
export interface BudgetSplit {
  readonly income: {
    readonly received: number;
    readonly expected: number;
    readonly total: number;
    readonly byOwner: Readonly<Record<Owner, number>>;
    readonly expectedSources: readonly ExpectedIncome[];
  };
  readonly sharedFixed: number;
  /** Part of `sharedFixed` that has not been paid yet (month view). */
  readonly sharedFixedPending: number;
  readonly household: {
    /** Shared variable spending in the period, per month. */
    readonly actual: number;
    /** Shared variable spending per month over the history. */
    readonly average: number;
    /** Budget used in the calculation: the user's amount, or the average. */
    readonly budget: number;
    readonly isCustom: boolean;
  };
  readonly free: number;
  readonly lines: readonly SplitLineResult[];
  readonly unallocated: number;
  /** Percentage not assigned to a line (percent mode only). */
  readonly unallocatedPercent: number | null;
  /** Total monthly contribution of all savings pots. */
  readonly potsMonthly: number;
}

export interface BudgetSplitInput {
  /** Transactions of the selected months, for every owner. */
  readonly transactions: readonly Transaction[];
  readonly monthCount: number;
  readonly isMonth: boolean;
  readonly fixedCosts: readonly FixedCostStatus[];
  readonly householdAverage: number;
  readonly householdBudget: number | null;
  readonly plan: SplitPlan;
  readonly pots: readonly SavingsPot[];
  readonly expected: readonly ExpectedIncome[];
  readonly catalog: CategoryCatalog;
}

const LINES: readonly SplitLine[] = ['savings', 'person1', 'person2'];
const TOP_CATEGORIES = 4;

const roundCents = (value: number) => (Math.abs(value) < 0.5 ? 0 : value);

/** Counterparties of shared fixed costs that count against the budget. */
export function sharedFixedKeys(
  fixedCosts: readonly { key: string; owner: Owner; excluded: boolean }[],
): Set<string> {
  return new Set(fixedCosts.filter((f) => !f.excluded && f.owner === 'shared').map((f) => f.key));
}

/** Average monthly shared spending that is not a fixed cost: groceries and the like. */
export function householdAverage(
  history: readonly Transaction[],
  historyMonths: number,
  fixedKeys: ReadonlySet<string>,
  catalog: CategoryCatalog,
): number {
  let spent = 0;
  for (const tx of history) {
    if (
      tx.owner === 'shared' &&
      !fixedKeys.has(tx.key) &&
      catalog.kindOf(tx.category) === 'expense'
    ) {
      spent -= tx.amount;
    }
  }
  return Math.max(0, spent / Math.max(1, historyMonths));
}

export function plannedAmount(plan: SplitPlan, line: SplitLine, free: number): number {
  const value = plan[line];
  return plan.mode === 'percent' ? (Math.max(0, free) * value) / 100 : value;
}

/** Switches between percentages and amounts while keeping the plan the same in euros. */
export function convertSplitMode(plan: SplitPlan, mode: SplitMode, free: number): SplitPlan {
  if (plan.mode === mode) return plan;
  const convert = (value: number) =>
    mode === 'amount'
      ? Math.round((Math.max(0, free) * value) / 100)
      : free > 0
        ? Math.round((value / free) * 1000) / 10
        : 0;
  return {
    mode,
    savings: convert(plan.savings),
    person1: convert(plan.person1),
    person2: convert(plan.person2),
  };
}

export function computeBudgetSplit(input: BudgetSplitInput): BudgetSplit {
  const { catalog, plan } = input;
  const months = Math.max(1, input.monthCount);
  const fixedKeys = sharedFixedKeys(input.fixedCosts);

  const incomeByOwner: Record<Owner, number> = { shared: 0, person1: 0, person2: 0 };
  const spentByOwner: Record<Owner, number> = { shared: 0, person1: 0, person2: 0 };
  const categoriesByOwner: Record<Owner, Map<string, number>> = {
    shared: new Map(),
    person1: new Map(),
    person2: new Map(),
  };
  let saved = 0;
  let household = 0;

  for (const tx of input.transactions) {
    switch (catalog.kindOf(tx.category)) {
      case 'income':
        incomeByOwner[tx.owner] += tx.amount;
        break;
      case 'savings':
        saved -= tx.amount;
        break;
      case 'expense': {
        spentByOwner[tx.owner] -= tx.amount;
        const byCategory = categoriesByOwner[tx.owner];
        byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) - tx.amount);
        if (tx.owner === 'shared' && !fixedKeys.has(tx.key)) household -= tx.amount;
        break;
      }
      case 'internal':
        break;
    }
  }

  const received = OWNERS.reduce((sum, owner) => sum + incomeByOwner[owner], 0) / months;
  const expected = input.expected.reduce((sum, e) => sum + e.amount, 0);
  const byOwner = Object.fromEntries(
    OWNERS.map((owner) => [
      owner,
      incomeByOwner[owner] / months +
        input.expected.filter((e) => e.owner === owner).reduce((sum, e) => sum + e.amount, 0),
    ]),
  ) as Record<Owner, number>;

  const sharedFixedCosts = input.fixedCosts.filter((f) => fixedKeys.has(f.key));
  const sharedFixed = sharedFixedCosts.reduce((sum, f) => sum + f.budgeted, 0);
  const sharedFixedPending = input.isMonth
    ? sharedFixedCosts.filter((f) => f.paid <= 0).reduce((sum, f) => sum + f.budgeted, 0)
    : 0;

  const householdBudget = input.householdBudget ?? Math.round(input.householdAverage);
  const totalIncome = received + expected;
  const free = totalIncome - sharedFixed - householdBudget;

  const lines = LINES.map((line): SplitLineResult => {
    const owner: Owner | null = line === 'savings' ? null : line;
    const categories = owner
      ? [...categoriesByOwner[owner]]
          .map(([name, amount]) => ({ name, amount: amount / months }))
          .filter((c) => c.amount > 0.5)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, TOP_CATEGORIES)
      : [];
    return {
      line,
      value: plan[line],
      planned: plannedAmount(plan, line, free),
      actual: (owner ? spentByOwner[owner] : saved) / months,
      categories,
    };
  });

  return {
    income: { received, expected, total: totalIncome, byOwner, expectedSources: input.expected },
    sharedFixed,
    sharedFixedPending,
    household: {
      actual: Math.max(0, household / months),
      average: input.householdAverage,
      budget: householdBudget,
      isCustom: input.householdBudget !== null,
    },
    free,
    lines,
    unallocated: roundCents(free - lines.reduce((sum, l) => sum + l.planned, 0)),
    unallocatedPercent:
      plan.mode === 'percent'
        ? Math.round((100 - plan.savings - plan.person1 - plan.person2) * 10) / 10
        : null,
    potsMonthly: input.pots.reduce((sum, p) => sum + p.monthly, 0),
  };
}
