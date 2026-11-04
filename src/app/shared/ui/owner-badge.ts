import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Owner, PersonNames, ownerLabel } from '../../core/models/owner';

/** Coloured name tag for money that belongs to one partner. Renders nothing for shared money. */
@Component({
  selector: 'app-owner-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (owner() !== 'shared') {
      <span
        class="badge"
        [class.person1]="owner() === 'person1'"
        [class.person2]="owner() === 'person2'"
      >
        {{ label() }}
      </span>
    }
  `,
  styles: `
    .badge {
      display: inline-block;
      border-radius: 20px;
      padding: 1px 8px;
      font-size: 11.5px;
      margin-left: 6px;
      vertical-align: 1px;
      white-space: nowrap;
    }
    .person1 {
      background: var(--person1-soft);
      color: var(--person1);
    }
    .person2 {
      background: var(--person2-soft);
      color: var(--person2);
    }
  `,
})
export class OwnerBadge {
  readonly owner = input.required<Owner>();
  readonly names = input.required<PersonNames>();
  protected readonly label = computed(() => ownerLabel(this.owner(), this.names()));
}
