import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PersonNames } from '../../../core/models/owner';
import { EuroPipe } from '../../../shared/format/pipes';
import { OwnerBadge } from '../../../shared/ui/owner-badge';
import { ProgressBar } from '../../../shared/ui/progress-bar';
import { CategoryRowVm } from '../../../state/dashboard-view-models';

/**
 * Amount per category with a bar, and either its share or (for a finished month) the
 * difference with the average. Clicking a row filters the transactions.
 */
@Component({
  selector: 'app-category-breakdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EuroPipe, OwnerBadge, ProgressBar],
  template: `
    @for (row of rows(); track row.name) {
      <button
        type="button"
        class="row"
        [class.active]="row.name === active()"
        [attr.aria-pressed]="row.name === active()"
        (click)="picked.emit(row.name)"
      >
        <span class="name">
          {{ row.name }}
          @if (row.owner) {
            <app-owner-badge [owner]="row.owner" [names]="names()" />
          }
        </span>
        <app-progress-bar [value]="row.amount / max()" [tone]="row.tone" [height]="8" />
        <span class="num">{{ row.amount | euro }}</span>
        <span class="num extra">
          @if (row.delta === null) {
            {{ percent(row.share) }}%
          } @else if (row.delta > -5 && row.delta < 5) {
            <span class="muted">≈ gem.</span>
          } @else {
            <span [class.negative]="isWorse(row)" [class.positive]="!isWorse(row)">
              {{ row.delta > 0 ? '+' : '−' }}{{ abs(row.delta) | euro }}
            </span>
          }
        </span>
      </button>
    } @empty {
      <p class="muted">Geen gegevens in deze periode.</p>
    }
  `,
  styleUrl: './category-breakdown.scss',
})
export class CategoryBreakdown {
  readonly rows = input.required<readonly CategoryRowVm[]>();
  readonly names = input.required<PersonNames>();
  readonly active = input('');
  readonly picked = output<string>();

  protected readonly max = computed(() => Math.max(1, ...this.rows().map((r) => r.amount)));

  /** Spending more (or earning less) than usual is shown in red. */
  protected isWorse(row: CategoryRowVm): boolean {
    return row.tone === 'income' ? (row.delta ?? 0) < 0 : (row.delta ?? 0) > 0;
  }

  protected abs(value: number): number {
    return Math.abs(value);
  }

  protected percent(share: number): number {
    return Math.round(share * 100);
  }
}
