import { Injectable, computed, inject, signal } from '@angular/core';
import { mergeTransactions } from '../core/import/bank-export';
import { BankTransaction } from '../core/models/transaction';
import { PERSISTENCE } from './persistence/persistence';

/**
 * Imported bank transactions, kept through the configured persistence (browser storage, or
 * the local database in development) so a new month's export can simply be added.
 * Demo data is never stored.
 */
@Injectable({ providedIn: 'root' })
export class TransactionsStore {
  private readonly persistence = inject(PERSISTENCE);
  private readonly state = signal<readonly BankTransaction[]>([]);
  private readonly demo = signal(false);
  private readonly saveFailedState = signal(false);

  readonly transactions = this.state.asReadonly();
  readonly hasData = computed(() => this.state().length > 0);
  readonly isDemo = this.demo.asReadonly();
  /** The last attempt to store or clear transactions failed. */
  readonly saveFailed = this.saveFailedState.asReadonly();

  /** Reads the stored transactions. Throws when the storage cannot be reached. */
  async load(): Promise<void> {
    this.state.set(await this.persistence.loadTransactions());
  }

  /**
   * Adds transactions (skipping ones already present) and stores the new ones.
   * They stay visible when storing fails; `saveFailed` tells the UI.
   */
  async add(incoming: readonly BankTransaction[]): Promise<{ added: number; duplicates: number }> {
    const result = mergeTransactions(this.state(), incoming);
    this.state.set(result.transactions);
    if (!this.demo() && result.added) {
      await this.track(this.persistence.addTransactions(result.transactions.slice(-result.added)));
    }
    return { added: result.added, duplicates: result.duplicates };
  }

  useDemo(transactions: readonly BankTransaction[]): void {
    this.demo.set(true);
    this.state.set(transactions);
  }

  /** Leaves the demo and shows the stored transactions again. */
  async useStored(): Promise<void> {
    try {
      await this.load();
    } finally {
      this.demo.set(false);
    }
  }

  /** Removes all stored transactions (in the demo only the demo data is dropped). */
  async clear(): Promise<void> {
    const wasDemo = this.demo();
    this.demo.set(false);
    this.state.set([]);
    if (!wasDemo) await this.track(this.persistence.clearTransactions());
  }

  private async track(operation: Promise<void>): Promise<void> {
    try {
      await operation;
      this.saveFailedState.set(false);
    } catch (error) {
      this.saveFailedState.set(true);
      throw error;
    }
  }
}
