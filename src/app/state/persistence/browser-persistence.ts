import { Injectable, inject } from '@angular/core';
import { mergeTransactions } from '../../core/import/bank-export';
import { Settings } from '../../core/models/settings';
import { BankTransaction, isBankTransaction } from '../../core/models/transaction';
import { BrowserStorage } from './browser-storage';
import type { Persistence } from './persistence';

export const TRANSACTIONS_KEY = 'geldoverzicht.transactions.v1';
export const SETTINGS_KEY = 'geldoverzicht.settings.v1';

/** Keeps everything in this browser's localStorage. Nothing leaves the device. */
@Injectable({ providedIn: 'root' })
export class BrowserPersistence implements Persistence {
  readonly kind = 'browser' as const;
  private readonly storage = inject(BrowserStorage);

  async loadTransactions(): Promise<BankTransaction[]> {
    const stored = this.storage.read(TRANSACTIONS_KEY);
    return Array.isArray(stored) ? stored.filter(isBankTransaction) : [];
  }

  async addTransactions(transactions: readonly BankTransaction[]): Promise<void> {
    if (!transactions.length) return;
    const { transactions: all } = mergeTransactions(await this.loadTransactions(), transactions);
    if (!this.storage.write(TRANSACTIONS_KEY, all)) {
      throw new Error('De browser kon de transacties niet bewaren (opslag vol of uitgeschakeld).');
    }
  }

  async clearTransactions(): Promise<void> {
    this.storage.remove(TRANSACTIONS_KEY);
  }

  async loadSettings(): Promise<unknown> {
    return this.storage.read(SETTINGS_KEY);
  }

  async saveSettings(settings: Settings): Promise<void> {
    if (!this.storage.write(SETTINGS_KEY, settings)) {
      throw new Error('De browser kon de instellingen niet bewaren.');
    }
  }
}
