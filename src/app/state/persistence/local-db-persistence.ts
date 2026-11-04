import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Settings } from '../../core/models/settings';
import { BankTransaction, isBankTransaction } from '../../core/models/transaction';
import type { Persistence } from './persistence';

/** Base URL of the local API; `ng serve --configuration local-db` proxies it to 127.0.0.1:3333. */
export const LOCAL_DB_URL = new InjectionToken<string>('LOCAL_DB_URL', {
  providedIn: 'root',
  factory: () => '/api',
});

/**
 * Talks to the local SQLite API in `server/` (development only). The database file stays on
 * this computer; the API only listens on 127.0.0.1.
 */
@Injectable({ providedIn: 'root' })
export class LocalDbPersistence implements Persistence {
  readonly kind = 'local-db' as const;
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(LOCAL_DB_URL);

  async loadTransactions(): Promise<BankTransaction[]> {
    const stored = await firstValueFrom(this.http.get<unknown>(`${this.baseUrl}/transactions`));
    return Array.isArray(stored) ? stored.filter(isBankTransaction) : [];
  }

  async addTransactions(transactions: readonly BankTransaction[]): Promise<void> {
    if (!transactions.length) return;
    await firstValueFrom(this.http.post(`${this.baseUrl}/transactions`, transactions));
  }

  async clearTransactions(): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/transactions`));
  }

  loadSettings(): Promise<unknown> {
    return firstValueFrom(this.http.get<unknown>(`${this.baseUrl}/settings`));
  }

  async saveSettings(settings: Settings): Promise<void> {
    await firstValueFrom(this.http.put(`${this.baseUrl}/settings`, settings));
  }
}
