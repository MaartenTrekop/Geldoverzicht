/** A calendar month written as `YYYY-MM`. Sorts correctly as a string. */
export type YearMonth = string;

const SHORT_NAMES = [
  'jan',
  'feb',
  'mrt',
  'apr',
  'mei',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
];
const LONG_NAMES = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];

function parts(month: YearMonth): [number, number] {
  const [year, m] = month.split('-').map(Number);
  return [year, m];
}

function format(year: number, month: number): YearMonth {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function toYearMonth(date: Date): YearMonth {
  return format(date.getFullYear(), date.getMonth() + 1);
}

export function addMonths(month: YearMonth, count: number): YearMonth {
  const [year, m] = parts(month);
  const index = year * 12 + (m - 1) + count;
  return format(Math.floor(index / 12), (index % 12) + 1);
}

/** Number of months from `from` to `to` (positive when `to` is later). */
export function monthsBetween(from: YearMonth, to: YearMonth): number {
  const [y1, m1] = parts(from);
  const [y2, m2] = parts(to);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Every month from `from` up to and including `to`. */
export function monthRange(from: YearMonth, to: YearMonth): YearMonth[] {
  const result: YearMonth[] = [];
  for (let month = from; month <= to; month = addMonths(month, 1)) result.push(month);
  return result;
}

/** "okt 2026" or, with `long`, "oktober 2026". */
export function formatMonth(month: YearMonth, style: 'short' | 'long' = 'short'): string {
  const [year, m] = parts(month);
  return `${(style === 'long' ? LONG_NAMES : SHORT_NAMES)[m - 1]} ${year}`;
}

/** Compact axis label: "okt '26". */
export function formatMonthAxis(month: YearMonth): string {
  const [year, m] = parts(month);
  return `${SHORT_NAMES[m - 1]} '${String(year).slice(2)}`;
}
