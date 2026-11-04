import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { OWNERS, Owner, PersonNames, ownerLabel } from '../../core/models/owner';

/** Picker for Samen / partner 1 / partner 2, optionally with "Iedereen" (`all`). */
@Component({
  selector: 'app-owner-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <select #select [attr.aria-label]="label()" (change)="changed.emit(select.value)">
      @if (allLabel(); as all) {
        <option value="all" [selected]="value() === 'all'">{{ all }}</option>
      }
      @for (option of options(); track option.value) {
        <option [value]="option.value" [selected]="option.value === value()">
          {{ option.label }}
        </option>
      }
    </select>
  `,
})
export class OwnerSelect {
  readonly value = input.required<string>();
  readonly names = input.required<PersonNames>();
  /** Label of an extra "everyone" option with value `all`; none when empty. */
  readonly allLabel = input('');
  readonly label = input('Van wie');
  readonly changed = output<string>();

  protected readonly options = computed(() =>
    OWNERS.map((owner: Owner) => ({ value: owner, label: ownerLabel(owner, this.names()) })),
  );
}
