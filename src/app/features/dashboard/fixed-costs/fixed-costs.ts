import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PersonNames } from '../../../core/models/owner';
import { EuroPipe } from '../../../shared/format/pipes';
import { OwnerBadge } from '../../../shared/ui/owner-badge';
import { FixedCostsVm } from '../../../state/dashboard-view-models';

const VISIBLE = 18;

/** Recognised fixed costs; in month view with a ✓ when paid. Click a row to exclude it. */
@Component({
  selector: 'app-fixed-costs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EuroPipe, OwnerBadge],
  templateUrl: './fixed-costs.html',
  styleUrl: './fixed-costs.scss',
})
export class FixedCosts {
  readonly vm = input.required<FixedCostsVm>();
  readonly names = input.required<PersonNames>();
  readonly exclusionToggled = output<string>();

  protected readonly visible = computed(() => this.vm().items.slice(0, VISIBLE));
  protected readonly hidden = computed(() => Math.max(0, this.vm().items.length - VISIBLE));

  protected readonly totals = computed(() => {
    const { items, isMonth, isRunningMonth } = this.vm();
    let paid = 0;
    let expected = 0;
    for (const item of items) {
      if (item.excluded) continue;
      if (!isMonth) paid += item.budgeted;
      else if (item.paid > 0) paid += item.paid;
      else if (isRunningMonth) expected += item.typical;
    }
    return { paid, expected };
  });
}
