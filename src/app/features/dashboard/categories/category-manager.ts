import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { CategoryCatalog, CustomCategory, categoryNameError } from '../../../core/models/category';
import { Owner, PersonNames, isOwner } from '../../../core/models/owner';
import { ModalDialog } from '../../../shared/ui/modal-dialog';
import { OwnerBadge } from '../../../shared/ui/owner-badge';
import { OwnerSelect } from '../../../shared/ui/owner-select';

export interface CategoryPreset {
  readonly kind: 'income' | 'expense';
  readonly owner: Owner;
}

/** Lists the user's own categories and adds new ones, e.g. "Paard" belonging to one partner. */
@Component({
  selector: 'app-category-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalDialog, OwnerBadge, OwnerSelect],
  templateUrl: './category-manager.html',
  styleUrl: './category-manager.scss',
})
export class CategoryManager {
  readonly open = input(false);
  readonly catalog = input.required<CategoryCatalog>();
  readonly names = input.required<PersonNames>();
  /** Defaults for the form, e.g. taken from the transaction the category is created for. */
  readonly preset = input<CategoryPreset>({ kind: 'expense', owner: 'shared' });

  readonly created = output<CustomCategory>();
  readonly removed = output<string>();
  readonly closed = output<void>();

  protected readonly name = signal('');
  protected readonly kind = linkedSignal(() => this.preset().kind);
  protected readonly owner = linkedSignal(() => this.preset().owner);
  protected readonly submitted = signal(false);

  protected readonly error = computed(() => {
    if (!this.submitted()) return '';
    switch (categoryNameError(this.catalog(), this.name())) {
      case 'empty':
        return 'Geef de categorie een naam.';
      case 'exists':
        return 'Die categorie bestaat al.';
      case null:
        return '';
    }
  });

  protected setKind(value: string): void {
    this.kind.set(value === 'income' ? 'income' : 'expense');
  }

  protected setOwner(value: string): void {
    if (isOwner(value)) this.owner.set(value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (categoryNameError(this.catalog(), this.name()) !== null) return;
    this.created.emit({ name: this.name().trim(), kind: this.kind(), owner: this.owner() });
    this.name.set('');
    this.submitted.set(false);
  }

  protected close(): void {
    this.name.set('');
    this.submitted.set(false);
    this.closed.emit();
  }
}
