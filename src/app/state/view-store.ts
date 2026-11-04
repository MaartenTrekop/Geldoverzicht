import { Injectable, signal } from '@angular/core';
import { Owner } from '../core/models/owner';
import { PeriodSelection, ViewMode } from '../core/period/period';
import { YearMonth } from '../core/period/months';

export const ALL = 'all';
export type OwnerFilter = Owner | typeof ALL;

export interface TableFilter {
  readonly query: string;
  readonly category: string;
  readonly owner: OwnerFilter;
  readonly limit: number;
}

export const TABLE_PAGE_SIZE = 50;

const INITIAL_TABLE: TableFilter = { query: '', category: ALL, owner: ALL, limit: TABLE_PAGE_SIZE };

/** What the user is looking at: period, account, person and the transaction table filters. */
@Injectable({ providedIn: 'root' })
export class ViewStore {
  private readonly selectionState = signal<PeriodSelection>({
    mode: 'month',
    month: null,
    from: null,
    to: null,
  });
  private readonly accountState = signal<string>(ALL);
  private readonly ownerState = signal<OwnerFilter>(ALL);
  private readonly tableState = signal<TableFilter>(INITIAL_TABLE);

  readonly selection = this.selectionState.asReadonly();
  /** IBAN of the account to show, or `all`. */
  readonly account = this.accountState.asReadonly();
  /** Whose money the whole page shows, or `all`. */
  readonly owner = this.ownerState.asReadonly();
  readonly table = this.tableState.asReadonly();

  showMonth(month: YearMonth): void {
    this.selectionState.update((s) => ({ ...s, mode: 'month', month }));
    this.resetTablePaging();
  }

  showRange(from: YearMonth, to: YearMonth): void {
    this.selectionState.update((s) => ({ ...s, mode: 'range', from, to }));
    this.resetTablePaging();
  }

  setMode(mode: ViewMode): void {
    this.selectionState.update((s) => ({ ...s, mode }));
  }

  setAccount(account: string): void {
    this.accountState.set(account);
  }

  setOwner(owner: OwnerFilter): void {
    this.ownerState.set(owner);
    this.resetTablePaging();
  }

  updateTable(change: Partial<Omit<TableFilter, 'limit'>>): void {
    this.tableState.update((t) => ({ ...t, ...change, limit: TABLE_PAGE_SIZE }));
  }

  /** Clicking a category again clears the filter. */
  toggleCategory(category: string): void {
    this.updateTable({ category: this.tableState().category === category ? ALL : category });
  }

  showMoreRows(): void {
    this.tableState.update((t) => ({ ...t, limit: t.limit + 4 * TABLE_PAGE_SIZE }));
  }

  reset(): void {
    this.selectionState.set({ mode: 'month', month: null, from: null, to: null });
    this.accountState.set(ALL);
    this.ownerState.set(ALL);
    this.tableState.set(INITIAL_TABLE);
  }

  private resetTablePaging(): void {
    this.tableState.update((t) => ({ ...t, limit: TABLE_PAGE_SIZE }));
  }
}
