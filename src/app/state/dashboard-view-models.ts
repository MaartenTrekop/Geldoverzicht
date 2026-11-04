import { FixedCostStatus } from '../core/analysis/fixed-costs';
import { PotBalance, PotProgress } from '../core/analysis/savings-pots';
import { FlowTotals } from '../core/analysis/totals';
import { Owner } from '../core/models/owner';
import { SavingsPot } from '../core/models/settings';
import { Transaction } from '../core/models/transaction';
import { YearMonth } from '../core/period/months';
import { ViewMode } from '../core/period/period';

/* Shapes the dashboard facade hands to the presentational components. */

export interface AccountOption {
  readonly iban: string;
  readonly label: string;
}

export interface PeriodVm {
  readonly mode: ViewMode;
  /** Selected month in month view. */
  readonly month: YearMonth | null;
  readonly from: YearMonth | null;
  readonly to: YearMonth | null;
  /** Months that can be selected. */
  readonly available: readonly YearMonth[];
  readonly today: YearMonth;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly isRunningMonth: boolean;
  readonly monthCount: number;
  readonly transactionCount: number;
  /** Accounts in the imported exports (only worth a filter when there is more than one). */
  readonly accounts: readonly AccountOption[];
  readonly account: string;
}

export interface KpiVm {
  readonly isMonth: boolean;
  readonly isRunningMonth: boolean;
  readonly monthCount: number;
  readonly totals: FlowTotals;
  readonly leftover: number;
  /** Average of the previous months (month view only). */
  readonly average: (FlowTotals & { readonly leftover: number }) | null;
  /** Regular income that has not come in yet (running month). */
  readonly expectedIncome: number;
}

export interface ChartPointVm {
  readonly month: YearMonth;
  readonly income: number;
  readonly expenses: number;
  readonly leftover: number;
}

export interface ChartVm {
  readonly points: readonly ChartPointVm[];
  readonly selected: readonly YearMonth[];
  /** Emphasise the selected month(s) and dim the others. */
  readonly highlightSelection: boolean;
}

export interface CategoryRowVm {
  readonly name: string;
  readonly amount: number;
  /** Share of the total, 0–1. */
  readonly share: number;
  /** Difference with the average of previous months, when comparable. */
  readonly delta: number | null;
  /** Owner implied by a custom category. */
  readonly owner: Owner | null;
  readonly tone: 'income' | 'expense' | 'savings';
}

export interface FixedCostsVm {
  readonly items: readonly FixedCostStatus[];
  readonly isMonth: boolean;
  readonly isRunningMonth: boolean;
  readonly historyMonths: number;
}

export interface PotVm {
  readonly pot: SavingsPot;
  readonly balance: PotBalance;
  readonly progress: PotProgress;
  /** Moved into the linked account in the selected period; `null` when not linked. */
  readonly contribution: number | null;
  readonly accountLabel: string | null;
}

export interface TableVm {
  readonly rows: readonly Transaction[];
  readonly total: number;
}
