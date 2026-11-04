import { SavingsPot } from '../models/settings';
import { Transaction } from '../models/transaction';
import { YearMonth, addMonths, monthsBetween } from '../period/months';

export interface PotBalance {
  readonly amount: number;
  /**
   * `export`: balance column of the linked account's own export;
   * `manual`: the balance the user entered (plus transfers to the linked account since then).
   */
  readonly source: 'export' | 'manual';
  /** Date of the export balance, or the date the manual balance was entered against. */
  readonly asOf: string | null;
  /** Transfers to the linked account added to the manual balance. */
  readonly transferred: number;
}

export interface PotProgress {
  /** 0–100, or `null` for a pot without a goal. */
  readonly percent: number | null;
  readonly reached: boolean;
  /** When the goal is reached at the current monthly amount. */
  readonly expectedMonth: YearMonth | null;
  readonly monthsToGoal: number | null;
  /** Monthly amount needed to make the deadline. */
  readonly requiredMonthly: number | null;
  /** Whether the monthly amount is enough for the deadline (`null` without a deadline). */
  readonly onTrack: boolean | null;
}

interface LedgerView {
  readonly transactions: readonly Transaction[];
  readonly ownAccounts: ReadonlySet<string>;
  readonly mainAccount: string | null;
}

/** Transfers from the main account to the pot's account (positive = money into the pot). */
function transfersTo(
  pot: SavingsPot,
  ledger: LedgerView,
  include: (tx: Transaction) => boolean,
): number {
  let total = 0;
  for (const tx of ledger.transactions) {
    if (tx.counterpartyIban !== pot.linkedAccount) continue;
    if (ledger.mainAccount && tx.account !== ledger.mainAccount) continue;
    if (include(tx)) total -= tx.amount;
  }
  return total;
}

export function potBalance(pot: SavingsPot, ledger: LedgerView): PotBalance {
  const account = pot.linkedAccount;
  if (account && ledger.ownAccounts.has(account)) {
    let latest: Transaction | null = null;
    for (const tx of ledger.transactions) {
      if (tx.account !== account || tx.balanceAfter === null) continue;
      if (!latest || tx.date > latest.date || (tx.date === latest.date && tx.order > latest.order))
        latest = tx;
    }
    if (latest && latest.balanceAfter !== null) {
      return { amount: latest.balanceAfter, source: 'export', asOf: latest.date, transferred: 0 };
    }
  }
  const since = pot.balanceDate ?? '';
  const transferred = account ? transfersTo(pot, ledger, (tx) => tx.date > since) : 0;
  return {
    amount: pot.balance + transferred,
    source: 'manual',
    asOf: pot.balanceDate,
    transferred,
  };
}

/** Net amount moved into the pot's account in the given months, or `null` for unlinked pots. */
export function potContribution(
  pot: SavingsPot,
  ledger: LedgerView,
  months: readonly YearMonth[],
): number | null {
  if (!pot.linkedAccount) return null;
  const selected = new Set(months);
  return transfersTo(pot, ledger, (tx) => selected.has(tx.month));
}

export function potProgress(
  pot: SavingsPot,
  balance: number,
  currentMonth: YearMonth,
): PotProgress {
  const none: PotProgress = {
    percent: null,
    reached: false,
    expectedMonth: null,
    monthsToGoal: null,
    requiredMonthly: null,
    onTrack: null,
  };
  if (pot.target <= 0) return none;

  const percent = Math.max(0, Math.min(100, (balance / pot.target) * 100));
  if (balance >= pot.target) return { ...none, percent: 100, reached: true };

  const remaining = pot.target - balance;
  const monthsToGoal = pot.monthly > 0 ? Math.ceil(remaining / pot.monthly) : null;
  const requiredMonthly = pot.deadline
    ? remaining / Math.max(1, monthsBetween(currentMonth, pot.deadline))
    : null;
  return {
    percent,
    reached: false,
    monthsToGoal,
    expectedMonth: monthsToGoal !== null ? addMonths(currentMonth, monthsToGoal) : null,
    requiredMonthly,
    onTrack: requiredMonthly !== null ? pot.monthly + 0.5 >= requiredMonthly : null,
  };
}
