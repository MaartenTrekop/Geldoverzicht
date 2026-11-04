import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatEuro } from '../../../shared/format/format';
import { EuroPipe } from '../../../shared/format/pipes';
import { KpiVm } from '../../../state/dashboard-view-models';

interface KpiCard {
  readonly label: string;
  readonly value: number;
  readonly hint: string;
  /** Colour of the dot in front of the label. */
  readonly dot: 'income' | 'expense' | 'savings' | null;
  /** Colour the value green/red (leftover). */
  readonly signed: boolean;
}

/** The four headline numbers: income, expenses, saved, left over. */
@Component({
  selector: 'app-kpi-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EuroPipe],
  template: `
    @for (card of cards(); track card.label) {
      <article class="card">
        <div class="label">
          @if (card.dot) {
            <span class="dot" [class]="card.dot"></span>
          }
          {{ card.label }}
        </div>
        <div
          class="value"
          [class.positive]="card.signed && card.value >= 0"
          [class.negative]="card.signed && card.value < 0"
        >
          {{ card.value | euro }}
        </div>
        <div class="hint">{{ card.hint }}</div>
      </article>
    }
  `,
  styleUrl: './kpi-summary.scss',
})
export class KpiSummary {
  readonly kpis = input.required<KpiVm>();

  protected readonly cards = computed((): KpiCard[] => {
    const k = this.kpis();
    const { income, expenses, savings } = k.totals;
    const perMonth = (value: number) =>
      `gem. ${formatEuro(value / Math.max(1, k.monthCount))} per maand`;
    const share = income > 0 ? `${Math.round((savings / income) * 100)}% van inkomen` : '';
    const compare = (value: number, average: number | undefined) => {
      if (average === undefined) return '';
      const difference = value - average;
      if (Math.abs(difference) < 1) return `gelijk aan gemiddeld (${formatEuro(average)})`;
      return `${formatEuro(Math.abs(difference))} ${difference > 0 ? 'meer' : 'minder'} dan gemiddeld (${formatEuro(average)})`;
    };

    let hints: [string, string, string, string];
    if (k.isRunningMonth) {
      const expected =
        k.expectedIncome > 0 ? ` · nog verwacht ${formatEuro(k.expectedIncome)}` : '';
      hints = [`tot nu toe${expected}`, 'tot nu toe', 'tot nu toe', 'tot nu toe'];
    } else if (k.isMonth) {
      const avg = k.average;
      hints = [
        compare(income, avg?.income),
        compare(expenses, avg?.expenses),
        share,
        compare(k.leftover, avg?.leftover),
      ];
    } else {
      hints = [
        perMonth(income),
        perMonth(expenses),
        [perMonth(savings), share].filter(Boolean).join(' · '),
        `${perMonth(k.leftover)}, na sparen`,
      ];
    }

    return [
      { label: 'Inkomsten', value: income, hint: hints[0], dot: 'income', signed: false },
      { label: 'Uitgaven', value: expenses, hint: hints[1], dot: 'expense', signed: false },
      { label: 'Gespaard / belegd', value: savings, hint: hints[2], dot: 'savings', signed: false },
      {
        label: 'Over na uitgaven & sparen',
        value: k.leftover,
        hint: hints[3],
        dot: null,
        signed: true,
      },
    ];
  });
}
