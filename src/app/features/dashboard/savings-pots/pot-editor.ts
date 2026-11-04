import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { Owner, PersonNames, isOwner } from '../../../core/models/owner';
import { SavingsPot } from '../../../core/models/settings';
import { parseEuroInput } from '../../../shared/format/format';
import { ModalDialog } from '../../../shared/ui/modal-dialog';
import { OwnerSelect } from '../../../shared/ui/owner-select';
import { AccountOption } from '../../../state/dashboard-view-models';

export type PotDraft = Omit<SavingsPot, 'balanceDate'>;

const newId = () => globalThis.crypto?.randomUUID?.() ?? `pot-${Date.now().toString(36)}`;

/** Create or edit a savings pot. Pass a new `pot` object each time the editor opens. */
@Component({
  selector: 'app-pot-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalDialog, OwnerSelect],
  templateUrl: './pot-editor.html',
})
export class PotEditor {
  readonly open = input(false);
  /** The pot to edit, or `null` for a new one. */
  readonly pot = input<SavingsPot | null>(null);
  readonly accounts = input<readonly AccountOption[]>([]);
  /** Accounts whose own export is imported, so their balance is known. */
  readonly exportedAccounts = input<readonly string[]>([]);
  readonly names = input.required<PersonNames>();

  readonly saved = output<PotDraft>();
  readonly deleted = output<string>();
  readonly closed = output<void>();

  protected readonly name = linkedSignal(() => this.pot()?.name ?? '');
  protected readonly target = linkedSignal(() => amountText(this.pot()?.target));
  protected readonly deadline = linkedSignal(() => this.pot()?.deadline ?? '');
  protected readonly monthly = linkedSignal(() => amountText(this.pot()?.monthly));
  protected readonly balance = linkedSignal(() => amountText(this.pot()?.balance));
  protected readonly linkedAccount = linkedSignal(() => this.pot()?.linkedAccount ?? '');
  protected readonly owner = linkedSignal<Owner>(() => this.pot()?.owner ?? 'shared');
  protected readonly error = signal('');

  protected readonly heading = computed(() =>
    this.pot() ? 'Spaarpotje bewerken' : 'Nieuw spaarpotje',
  );
  protected readonly balanceFromExport = computed(() =>
    this.exportedAccounts().includes(this.linkedAccount()),
  );
  protected readonly accountHint = computed(() => {
    if (!this.linkedAccount()) return 'Werk het saldo zelf bij wanneer je wilt.';
    return this.balanceFromExport()
      ? 'Deze rekening zit in je export: het saldo komt automatisch uit het bestand.'
      : 'Vul het huidige saldo in. Latere overboekingen naar deze rekening worden er automatisch bij opgeteld.';
  });

  protected setOwner(value: string): void {
    if (isOwner(value)) this.owner.set(value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const name = this.name().trim();
    if (!name) {
      this.error.set('Geef het potje een naam.');
      return;
    }
    this.error.set('');
    this.saved.emit({
      id: this.pot()?.id ?? newId(),
      name,
      target: Math.max(0, parseEuroInput(this.target()) ?? 0),
      deadline: this.deadline() || null,
      monthly: Math.max(0, parseEuroInput(this.monthly()) ?? 0),
      balance: parseEuroInput(this.balance()) ?? 0,
      linkedAccount: this.linkedAccount() || null,
      owner: this.owner(),
    });
  }

  protected remove(): void {
    const pot = this.pot();
    if (pot) this.deleted.emit(pot.id);
  }
}

function amountText(value: number | undefined): string {
  return value ? String(value).replace('.', ',') : '';
}
