import { addMonths, formatMonth, formatMonthAxis, monthRange, monthsBetween } from './months';
import { availableMonths, lastCompleteMonth, quickRange, resolvePeriod } from './period';

describe('months', () => {
  it('adds months across year boundaries', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthsBetween('2026-11', '2027-06')).toBe(7);
  });

  it('lists every month in a range', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('formats Dutch month names', () => {
    expect(formatMonth('2026-10')).toBe('okt 2026');
    expect(formatMonth('2026-10', 'long')).toBe('oktober 2026');
    expect(formatMonthAxis('2026-03')).toBe("mrt '26");
  });
});

describe('period', () => {
  const available = availableMonths(['2026-01', '2025-11', '2026-01', '2026-03']);

  it('fills gaps between the first and last month with data', () => {
    expect(available).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
  });

  it('skips the running month when picking the default month', () => {
    expect(lastCompleteMonth(available, '2026-03')).toBe('2026-02');
    expect(lastCompleteMonth(available, '2026-05')).toBe('2026-03');
    expect(lastCompleteMonth(['2026-03'], '2026-03')).toBe('2026-03');
  });

  it('resolves a month selection with up to twelve months of history', () => {
    const period = resolvePeriod(
      { mode: 'month', month: '2026-01', from: null, to: null },
      available,
      '2026-03',
    );
    expect(period.months).toEqual(['2026-01']);
    expect(period.history).toEqual(['2025-11', '2025-12', '2026-01']);
    expect(period.previous).toEqual(['2025-11', '2025-12']);
    expect(period.isRunningMonth).toBe(false);
  });

  it('falls back to the last complete month when the selection is not available', () => {
    const period = resolvePeriod(
      { mode: 'month', month: '2019-01', from: null, to: null },
      available,
      '2026-03',
    );
    expect(period.months).toEqual(['2026-02']);
  });

  it('marks the current calendar month as running', () => {
    const period = resolvePeriod(
      { mode: 'month', month: '2026-03', from: null, to: null },
      available,
      '2026-03',
    );
    expect(period.isRunningMonth).toBe(true);
  });

  it('resolves and orders a range selection', () => {
    const period = resolvePeriod(
      { mode: 'range', month: null, from: '2026-02', to: '2025-12' },
      available,
      '2026-03',
    );
    expect(period.months).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(period.history).toEqual(period.months);
  });

  it('provides quick ranges', () => {
    expect(quickRange('all', available, '2026-03')).toEqual({ from: '2025-11', to: '2026-03' });
    expect(quickRange('thisYear', available, '2026-03')).toEqual({
      from: '2026-01',
      to: '2026-03',
    });
    expect(quickRange('last12', available, '2026-03')).toEqual({ from: '2025-11', to: '2026-02' });
    expect(quickRange('all', [], '2026-03')).toBeNull();
  });
});
