import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { PersonNames } from '../../../core/models/owner';
import { SavingsPot } from '../../../core/models/settings';
import { formatEuro } from '../../../shared/format/format';
import { AccountOption, PotVm } from '../../../state/dashboard-view-models';
import { PotCard } from './pot-card';
import { PotDraft, PotEditor } from './pot-editor';

/** Grid of savings pots with an editor for adding and changing them. */
@Component({
  selector: 'app-savings-pots',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PotCard, PotEditor],
  template: `
    <header class="head">
      <h2>Spaarpotjes</h2>
      <span class="sub">{{ summary() }}</span>
    </header>
    <div class="grid">
      @for (vm of pots(); track vm.pot.id) {
        <app-pot-card
          [vm]="vm"
          [names]="names()"
          [isMonth]="isMonth()"
          [monthCount]="monthCount()"
          (edit)="openEditor(vm.pot)"
        />
      }
      <button type="button" class="add" (click)="openEditor(null)">
        <span class="plus">+</span>
        Nieuw spaarpotje
      </button>
    </div>
    <app-pot-editor
      [open]="editing() !== undefined"
      [pot]="editing() ?? null"
      [accounts]="accounts()"
      [exportedAccounts]="exportedAccounts()"
      [names]="names()"
      (saved)="save($event)"
      (deleted)="remove($event)"
      (closed)="editing.set(undefined)"
    />
  `,
  styleUrl: './savings-pots.scss',
})
export class SavingsPots {
  readonly pots = input.required<readonly PotVm[]>();
  readonly accounts = input<readonly AccountOption[]>([]);
  readonly exportedAccounts = input<readonly string[]>([]);
  readonly names = input.required<PersonNames>();
  readonly isMonth = input(true);
  readonly monthCount = input(1);

  readonly saved = output<PotDraft>();
  readonly removed = output<string>();

  /** Pot being edited: `null` for a new pot, `undefined` when the editor is closed. */
  protected readonly editing = signal<SavingsPot | null | undefined>(undefined);

  protected readonly summary = computed(() => {
    const pots = this.pots();
    if (!pots.length) return 'Maak potjes voor je spaardoelen, zoals een buffer of vakantie';
    const total = pots.reduce((sum, p) => sum + p.balance.amount, 0);
    const monthly = pots.reduce((sum, p) => sum + p.pot.monthly, 0);
    return `${formatEuro(total)} in ${pots.length} ${pots.length === 1 ? 'potje' : 'potjes'} · ${formatEuro(monthly)} per maand`;
  });

  protected openEditor(pot: SavingsPot | null): void {
    // A fresh object resets the editor's fields, also when the same pot is opened again.
    this.editing.set(pot ? { ...pot } : null);
  }

  protected save(draft: PotDraft): void {
    this.saved.emit(draft);
    this.editing.set(undefined);
  }

  protected remove(id: string): void {
    this.removed.emit(id);
    this.editing.set(undefined);
  }
}
