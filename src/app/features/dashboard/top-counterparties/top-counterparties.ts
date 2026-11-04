import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CounterpartyTotal } from '../../../core/analysis/totals';
import { PersonNames } from '../../../core/models/owner';
import { EuroPipe } from '../../../shared/format/pipes';
import { OwnerBadge } from '../../../shared/ui/owner-badge';

/** Where most of the money went in the selected period. */
@Component({
  selector: 'app-top-counterparties',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EuroPipe, OwnerBadge],
  template: `
    @for (row of rows(); track row.key) {
      <div class="list-row">
        <span class="label">
          {{ row.name }}<small>{{ row.count }}×</small>
          <app-owner-badge [owner]="row.owner" [names]="names()" />
        </span>
        <span class="num">{{ row.amount | euro }}</span>
      </div>
    } @empty {
      <p class="muted">Geen uitgaven in deze periode.</p>
    }
  `,
})
export class TopCounterparties {
  readonly rows = input.required<readonly CounterpartyTotal[]>();
  readonly names = input.required<PersonNames>();
}
