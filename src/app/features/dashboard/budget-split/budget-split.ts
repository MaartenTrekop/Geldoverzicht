import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BudgetSplit, SplitLineResult } from '../../../core/analysis/budget-split';
import { OWNERS, Owner, PersonNames, ownerLabel } from '../../../core/models/owner';
import { SavingsPot, SplitLine, SplitMode } from '../../../core/models/settings';
import { formatEuro, parseEuroInput } from '../../../shared/format/format';
import { EuroPipe } from '../../../shared/format/pipes';
import { ProgressBar, ProgressTone } from '../../../shared/ui/progress-bar';
import { SegmentedControl, SegmentOption } from '../../../shared/ui/segmented-control';

interface LineView {
  readonly result: SplitLineResult;
  readonly name: string;
  readonly owner: Owner | null;
  readonly ratio: number;
  readonly tone: ProgressTone;
  readonly status: string;
  readonly chips: readonly { label: string; category: string | null }[];
  readonly note: { text: string; warning: boolean } | null;
}

/** Income − shared fixed costs − household budget = free budget, split over savings and two partners. */
@Component({
  selector: 'app-budget-split',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EuroPipe, ProgressBar, SegmentedControl],
  templateUrl: './budget-split.html',
  styleUrl: './budget-split.scss',
})
export class BudgetSplitCard {
  readonly split = input.required<BudgetSplit>();
  readonly mode = input.required<SplitMode>();
  readonly names = input.required<PersonNames>();
  readonly heading = input.required<string>();
  readonly subtitle = input('');
  readonly isMonth = input(true);
  readonly pots = input<readonly SavingsPot[]>([]);

  readonly valueChange = output<{ line: SplitLine; value: number }>();
  readonly modeChange = output<SplitMode>();
  readonly householdChange = output<number | null>();
  readonly rename = output<{ index: 0 | 1; name: string }>();
  readonly categorySelect = output<{ category: string; owner: Owner }>();

  protected readonly modes: SegmentOption[] = [
    { value: 'percent', label: '%' },
    { value: 'amount', label: '€' },
  ];

  protected readonly incomeBreakdown = computed(() => {
    const { income } = this.split();
    const parts = OWNERS.filter((o) => income.byOwner[o] > 0.5).map(
      (o) => `${ownerLabel(o, this.names())} ${formatEuro(income.byOwner[o])}`,
    );
    return parts.length > 1 ? parts.join(' · ') : '';
  });

  protected readonly expectedText = computed(() => {
    const { income } = this.split();
    if (income.expected <= 0) return '';
    const sources = income.expectedSources.map((s) => s.name).join(', ');
    return `binnen ${formatEuro(income.received)} · nog verwacht ${formatEuro(income.expected)} (${sources})`;
  });

  protected readonly lines = computed((): LineView[] => {
    const split = this.split();
    const names = this.names();
    return split.lines.map((result) => {
      const owner: Owner | null = result.line === 'savings' ? null : result.line;
      const { planned, actual } = result;
      const ratio = planned > 0 ? actual / planned : actual > 0 ? 1 : 0;
      if (!owner) {
        const potsMonthly = split.potsMonthly;
        const pots = this.pots().filter((p) => p.monthly > 0);
        const note =
          potsMonthly > planned + 1
            ? {
                text: `Je spaarpotjes vragen ${formatEuro(potsMonthly)} per maand, ${formatEuro(potsMonthly - planned)} meer dan dit plan`,
                warning: true,
              }
            : pots.length && planned - potsMonthly > 1
              ? {
                  text: `${formatEuro(planned - potsMonthly)} per maand nog niet in een potje`,
                  warning: false,
                }
              : null;
        return {
          result,
          name: 'Sparen & beleggen',
          owner,
          ratio,
          tone: 'savings' as const,
          status:
            planned <= 0
              ? ''
              : actual >= planned
                ? 'op schema'
                : `${formatEuro(planned - actual)} onder plan`,
          chips: pots.map((p) => ({ label: `${p.name} ${formatEuro(p.monthly)}`, category: null })),
          note,
        };
      }
      const over = actual > planned + 0.5;
      return {
        result,
        name: `Eigen geld ${ownerLabel(owner, names)}`,
        owner,
        ratio,
        tone: over ? ('expense' as const) : ('income' as const),
        status: over
          ? `${formatEuro(actual - planned)} over budget`
          : `nog ${formatEuro(planned - actual)} te besteden`,
        chips: result.categories.map((c) => ({
          label: `${c.name} ${formatEuro(c.amount)}`,
          category: c.name,
        })),
        note: result.categories.length
          ? null
          : { text: 'Nog geen uitgaven toegewezen', warning: false },
      };
    });
  });

  protected setValue(line: SplitLine, text: string): void {
    this.valueChange.emit({ line, value: parseEuroInput(text) ?? 0 });
  }

  protected setMode(mode: string): void {
    this.modeChange.emit(mode === 'amount' ? 'amount' : 'percent');
  }

  protected setHousehold(text: string): void {
    this.householdChange.emit(parseEuroInput(text));
  }

  protected renamePerson(index: 0 | 1, name: string): void {
    this.rename.emit({ index, name });
  }

  protected selectCategory(category: string | null, owner: Owner | null): void {
    if (category && owner) this.categorySelect.emit({ category, owner });
  }
}
