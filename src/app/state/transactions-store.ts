import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { mergeTransactions } from '../core/import/bank-export';
import { BankTransaction } from '../core/models/transaction';
import { BrowserStorage } from './browser-storage';

const STORAGE_KEY = 'geldoverzicht.transactions.v1';

function isBankTransaction(value: unknown): value is BankTransaction {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t['id'] === 'string' &&
    typeof t['date'] === 'string' &&
    typeof t['month'] === 'string' &&
    typeof t['amount'] === 'number' &&
    typeof t['account'] === 'string' &&
    typeof t['counterpartyIban'] === 'string' &&
    typeof t['counterpartyName'] === 'string' &&
    typeof t['description'] === 'string' &&
    typeof t['code'] === 'string'
  );
}

/**
 * Imported bank transactions. Kept in this browser so a new month's export can simply be
 * added; nothing is sent anywhere. Demo data is never stored.
 */
@Injectable({ providedIn: 'root' })
export class TransactionsStore {
  private readonly storage = inject(BrowserStorage);
  private readonly state = signal<readonly BankTransaction[]>(this.loadStored());
  private readonly demo = signal(false);
  private readonly saveFailed = signal(false);

  readonly transactions = this.state.asReadonly();
  readonly hasData = computed(() => this.state().length > 0);
  readonly isDemo = this.demo.asReadonly();
  /** The browser refused to store the transactions (storage full or disabled). */
  readonly notPersisted = this.saveFailed.asReadonly();

  constructor() {
    effect(() => {
      const transactions = this.state();
      if (this.demo()) return;
      if (transactions.length) this.saveFailed.set(!this.storage.write(STORAGE_KEY, transactions));
      else this.storage.remove(STORAGE_KEY);
    });
  }

  add(incoming: readonly BankTransaction[]): { added: number; duplicates: number } {
    const result = mergeTransactions(this.state(), incoming);
    this.state.set(result.transactions);
    return { added: result.added, duplicates: result.duplicates };
  }

  useDemo(transactions: readonly BankTransaction[]): void {
    this.demo.set(true);
    this.state.set(transactions);
  }

  useStored(): void {
    this.demo.set(false);
    this.state.set(this.loadStored());
  }

  clear(): void {
    this.demo.set(false);
    this.state.set([]);
  }

  private loadStored(): BankTransaction[] {
    const stored = this.storage.read(STORAGE_KEY);
    return Array.isArray(stored) ? stored.filter(isBankTransaction) : [];
  }
}
