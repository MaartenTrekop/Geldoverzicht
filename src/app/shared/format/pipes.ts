import { Pipe, PipeTransform } from '@angular/core';
import { YearMonth, formatMonth } from '../../core/period/months';
import { formatDate, formatEuro, formatSignedEuro } from './format';

/** `{{ amount | euro }}` → "€ 1.234"; `{{ amount | euro: 2 }}` → "€ 1.234,56". */
@Pipe({ name: 'euro' })
export class EuroPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals: 0 | 2 = 0): string {
    return value === null || value === undefined ? '' : formatEuro(value, decimals);
  }
}

/** Transaction amount with an explicit plus sign for money coming in. */
@Pipe({ name: 'signedEuro' })
export class SignedEuroPipe implements PipeTransform {
  transform(value: number): string {
    return formatSignedEuro(value);
  }
}

/** `{{ '2026-10' | monthLabel }}` → "okt 2026"; with `'long'` → "oktober 2026". */
@Pipe({ name: 'monthLabel' })
export class MonthLabelPipe implements PipeTransform {
  transform(value: YearMonth | null | undefined, style: 'short' | 'long' = 'short'): string {
    return value ? formatMonth(value, style) : '';
  }
}

/** `2026-10-03` → `03-10-2026`. */
@Pipe({ name: 'dutchDate' })
export class DutchDatePipe implements PipeTransform {
  transform(value: string): string {
    return formatDate(value);
  }
}
