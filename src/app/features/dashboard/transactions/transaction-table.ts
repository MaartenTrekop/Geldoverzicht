import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CategoryCatalog } from '../../../core/models/category';
import { Owner, PersonNames, isOwner } from '../../../core/models/owner';
import { OverrideScope } from '../../../core/models/settings';
import { Transaction } from '../../../core/models/transaction';
import { DutchDatePipe, SignedEuroPipe } from '../../../shared/format/pipes';
import { CategorySelect } from '../../../shared/ui/category-select';
import { OwnerSelect } from '../../../shared/ui/owner-select';
import { TableVm } from '../../../state/dashboard-view-models';
import { OwnerFilter, TableFilter } from '../../../state/view-store';

/** Searchable list of transactions where category and owner can be changed. */
@Component({
  selector: 'app-transaction-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CategorySelect, OwnerSelect, DutchDatePipe, SignedEuroPipe],
  templateUrl: './transaction-table.html',
  styleUrl: './transaction-table.scss',
})
export class TransactionTable {
  readonly table = input.required<TableVm>();
  readonly filter = input.required<TableFilter>();
  readonly catalog = input.required<CategoryCatalog>();
  readonly names = input.required<PersonNames>();
  readonly scope = input.required<OverrideScope>();

  readonly categoryChange = output<{ tx: Transaction; category: string }>();
  readonly ownerChange = output<{ tx: Transaction; owner: Owner }>();
  readonly createCategory = output<Transaction>();
  readonly filterChange = output<Partial<Omit<TableFilter, 'limit'>>>();
  readonly scopeChange = output<OverrideScope>();
  readonly showMore = output<void>();
  readonly manageCategories = output<void>();
  readonly resetOverrides = output<void>();

  protected readonly remaining = computed(() => this.table().total - this.table().rows.length);

  protected setOwner(tx: Transaction, owner: string): void {
    if (isOwner(owner)) this.ownerChange.emit({ tx, owner });
  }

  protected setOwnerFilter(owner: string): void {
    const filter: OwnerFilter = isOwner(owner) ? owner : 'all';
    this.filterChange.emit({ owner: filter });
  }

  protected setScope(scope: string): void {
    this.scopeChange.emit(scope === 'transaction' ? 'transaction' : 'counterparty');
  }
}
