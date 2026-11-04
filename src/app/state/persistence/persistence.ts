import { InjectionToken, inject } from '@angular/core';
import { Settings } from '../../core/models/settings';
import { BankTransaction } from '../../core/models/transaction';
import { BrowserPersistence } from './browser-persistence';

/** Where the app keeps imported transactions and the user's settings. */
export interface Persistence {
  /** `browser`: localStorage (default, also on GitHub Pages). `local-db`: the local SQLite API. */
  readonly kind: 'browser' | 'local-db';
  loadTransactions(): Promise<BankTransaction[]>;
  /** Stores new transactions; ids that are already stored are ignored. */
  addTransactions(transactions: readonly BankTransaction[]): Promise<void>;
  clearTransactions(): Promise<void>;
  /** Raw stored settings (validated by the caller), or `null` when nothing is stored. */
  loadSettings(): Promise<unknown>;
  saveSettings(settings: Settings): Promise<void>;
}

/**
 * The persistence the stores use. Defaults to the browser; the `local-db` build
 * configuration swaps in the local database (see `src/environments`).
 */
export const PERSISTENCE = new InjectionToken<Persistence>('PERSISTENCE', {
  providedIn: 'root',
  factory: () => inject(BrowserPersistence),
});
