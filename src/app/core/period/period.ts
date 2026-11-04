import { YearMonth, monthRange } from './months';

/** Look at one month at a time, or at a range of months as averages. */
export type ViewMode = 'month' | 'range';

export type QuickRange = 'last12' | 'thisYear' | 'all';

export interface PeriodSelection {
  readonly mode: ViewMode;
  readonly month: YearMonth | null;
  readonly from: YearMonth | null;
  readonly to: YearMonth | null;
}

export interface ResolvedPeriod {
  readonly mode: ViewMode;
  /** Months whose transactions are shown. */
  readonly months: readonly YearMonth[];
  /** Months used for averages, fixed-cost detection and the chart (up to 12 months in month view). */
  readonly history: readonly YearMonth[];
  /** History without the selected month, for "compared to your average" figures. */
  readonly previous: readonly YearMonth[];
  /** The selected month is the current calendar month, so not everything has come in yet. */
  readonly isRunningMonth: boolean;
}

const HISTORY_LENGTH = 12;

/** Every month between the first and the last month that has transactions. */
export function availableMonths(monthsWithData: Iterable<YearMonth>): YearMonth[] {
  const sorted = [...new Set(monthsWithData)].sort();
  return sorted.length ? monthRange(sorted[0], sorted[sorted.length - 1]) : [];
}

/** The latest month that is over; the running month only counts when it is all there is. */
export function lastCompleteMonth(
  available: readonly YearMonth[],
  today: YearMonth,
): YearMonth | null {
  if (!available.length) return null;
  const last = available[available.length - 1];
  return last === today && available.length > 1 ? available[available.length - 2] : last;
}

export function quickRange(
  kind: QuickRange,
  available: readonly YearMonth[],
  today: YearMonth,
): { from: YearMonth; to: YearMonth } | null {
  if (!available.length) return null;
  const first = available[0];
  const last = available[available.length - 1];
  switch (kind) {
    case 'all':
      return { from: first, to: last };
    case 'thisYear': {
      const january = `${last.slice(0, 4)}-01`;
      return { from: january < first ? first : january, to: last };
    }
    case 'last12': {
      const end = lastCompleteMonth(available, today) ?? last;
      const index = available.indexOf(end);
      return { from: available[Math.max(0, index - (HISTORY_LENGTH - 1))], to: end };
    }
  }
}

/**
 * Turns the user's selection into concrete month lists, falling back to sensible defaults
 * when the selection does not match the data (e.g. right after importing a new file).
 */
export function resolvePeriod(
  selection: PeriodSelection,
  available: readonly YearMonth[],
  today: YearMonth,
): ResolvedPeriod {
  if (!available.length) {
    return { mode: selection.mode, months: [], history: [], previous: [], isRunningMonth: false };
  }

  if (selection.mode === 'month') {
    const month =
      selection.month && available.includes(selection.month)
        ? selection.month
        : (lastCompleteMonth(available, today) as YearMonth);
    const index = available.indexOf(month);
    const history = available.slice(Math.max(0, index - (HISTORY_LENGTH - 1)), index + 1);
    return {
      mode: 'month',
      months: [month],
      history,
      previous: history.filter((m) => m !== month),
      isRunningMonth: month === today,
    };
  }

  const fallback = quickRange('last12', available, today)!;
  let from = selection.from && available.includes(selection.from) ? selection.from : fallback.from;
  let to = selection.to && available.includes(selection.to) ? selection.to : fallback.to;
  if (from > to) [from, to] = [to, from];
  const months = monthRange(from, to);
  return { mode: 'range', months, history: months, previous: [], isRunningMonth: false };
}
