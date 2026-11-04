import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PersonNames } from '../../../core/models/owner';
import { formatMonth } from '../../../core/period/months';
import { formatDate, formatEuro } from '../../../shared/format/format';
import { EuroPipe } from '../../../shared/format/pipes';
import { OwnerBadge } from '../../../shared/ui/owner-badge';
import { ProgressBar } from '../../../shared/ui/progress-bar';
import { PotVm } from '../../../state/dashboard-view-models';

/** One savings pot: balance, progress towards the goal and this period's contribution. */
@Component({
  selector: 'app-pot-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EuroPipe, OwnerBadge, ProgressBar],
  template: `
    @let v = vm();
    <button
      type="button"
      class="pot"
      (click)="edit.emit()"
      [attr.aria-label]="'Spaarpotje ' + v.pot.name + ' bewerken'"
    >
      <span class="head">
        <span class="name">{{ v.pot.name }}</span>
        <app-owner-badge [owner]="v.pot.owner" [names]="names()" />
      </span>
      <span class="balance">
        {{ v.balance.amount | euro }}
        @if (v.pot.target > 0) {
          <span class="muted">van {{ v.pot.target | euro }}</span>
        }
      </span>
      @if (v.progress.percent !== null) {
        <app-progress-bar [value]="v.progress.percent / 100" tone="savings" [height]="8" />
      }
      <span class="meta">{{ plan() }}</span>
      @if (goal(); as g) {
        <span class="meta" [class.negative]="g.warning" [class.positive]="g.done">{{
          g.text
        }}</span>
      }
      @if (contribution()) {
        <span class="meta">{{ contribution() }}</span>
      }
      <span class="source">{{ source() }}</span>
    </button>
  `,
  styleUrl: './pot-card.scss',
})
export class PotCard {
  readonly vm = input.required<PotVm>();
  readonly names = input.required<PersonNames>();
  readonly isMonth = input(true);
  readonly monthCount = input(1);
  readonly edit = output<void>();

  protected readonly plan = computed(() => {
    const { pot, accountLabel } = this.vm();
    const monthly = pot.monthly > 0 ? `${formatEuro(pot.monthly)} per maand` : 'Geen vaste inleg';
    return accountLabel ? `${monthly} · ${accountLabel}` : monthly;
  });

  protected readonly goal = computed(
    (): { text: string; warning: boolean; done: boolean } | null => {
      const { pot, progress } = this.vm();
      if (pot.target <= 0) return null;
      if (progress.reached) return { text: 'Doel bereikt 🎉', warning: false, done: true };
      if (pot.deadline && progress.requiredMonthly !== null) {
        return progress.onTrack
          ? {
              text: `Op schema voor ${formatMonth(pot.deadline, 'long')}`,
              warning: false,
              done: false,
            }
          : {
              text: `Voor ${formatMonth(pot.deadline, 'long')} is ${formatEuro(progress.requiredMonthly)} per maand nodig`,
              warning: true,
              done: false,
            };
      }
      if (progress.expectedMonth && progress.monthsToGoal !== null) {
        return {
          text: `Doel bereikt rond ${formatMonth(progress.expectedMonth, 'long')} (${progress.monthsToGoal} mnd)`,
          warning: false,
          done: false,
        };
      }
      return { text: 'Stel een maandelijkse inleg in', warning: false, done: false };
    },
  );

  protected readonly contribution = computed(() => {
    const { pot, contribution } = this.vm();
    if (contribution === null) return '';
    if (!this.isMonth())
      return `Gemiddeld ${formatEuro(contribution / Math.max(1, this.monthCount()))} per maand ingelegd`;
    if (contribution > 0.5) {
      const enough =
        pot.monthly > 0
          ? contribution + 0.5 >= pot.monthly
            ? ' ✓'
            : ` van ${formatEuro(pot.monthly)}`
          : '';
      return `Deze maand ${formatEuro(contribution)} ingelegd${enough}`;
    }
    if (contribution < -0.5) return `Deze maand ${formatEuro(-contribution)} opgenomen`;
    return 'Deze maand nog niets ingelegd';
  });

  protected readonly source = computed(() => {
    const { balance } = this.vm();
    const date = balance.asOf ? formatDate(balance.asOf) : '';
    if (balance.source === 'export') return `saldo volgens export (${date})`;
    if (balance.transferred) {
      return `saldo + ${formatEuro(balance.transferred)} overgemaakt${date ? ` sinds ${date}` : ''}`;
    }
    return 'handmatig bijgehouden saldo';
  });
}
