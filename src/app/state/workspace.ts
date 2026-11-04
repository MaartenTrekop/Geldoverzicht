import { Injectable, computed, inject, signal } from '@angular/core';
import { UnsupportedExportError, parseBankExport } from '../core/import/bank-export';
import { decodeText, parseCsv } from '../core/import/csv';
import { BankTransaction } from '../core/models/transaction';
import { createDemoSettings, generateDemoExport } from '../core/demo/demo-export';
import { CLOCK } from './clock';
import { PERSISTENCE } from './persistence/persistence';
import { SettingsStore } from './settings-store';
import { TransactionsStore } from './transactions-store';
import { ViewStore } from './view-store';

export interface ImportReport {
  readonly added: number;
  readonly duplicates: number;
  readonly errors: readonly string[];
}

const LOCAL_DB_HINT =
  'Start de database met `npm run api` (of alles samen met `npm run start:local`).';

/** Use cases that span several stores: loading, importing files, the demo and starting over. */
@Injectable({ providedIn: 'root' })
export class Workspace {
  private readonly transactions = inject(TransactionsStore);
  private readonly settings = inject(SettingsStore);
  private readonly view = inject(ViewStore);
  private readonly clock = inject(CLOCK);

  /** `browser` or `local-db`. */
  readonly storage = inject(PERSISTENCE).kind;
  readonly hasData = this.transactions.hasData;
  readonly isDemo = this.transactions.isDemo;

  private readonly loadFailed = signal(false);

  /** A message when stored data could not be read or written, otherwise `null`. */
  readonly storageProblem = computed((): string | null => {
    const localDb = this.storage === 'local-db';
    if (this.loadFailed()) {
      return localDb
        ? `De lokale database is niet bereikbaar. ${LOCAL_DB_HINT} Herlaad daarna de pagina.`
        : 'Je bewaarde gegevens konden niet worden gelezen.';
    }
    if (this.transactions.saveFailed() || this.settings.saveFailed()) {
      return localDb
        ? `Opslaan in de lokale database is mislukt. Draait de API nog? ${LOCAL_DB_HINT}`
        : 'Je gegevens konden niet in deze browser worden bewaard (opslag vol of uitgeschakeld). Ze blijven zichtbaar tot je de pagina sluit.';
    }
    return null;
  });

  /** Reads stored transactions and settings. Runs before the first page is shown; never throws. */
  async load(): Promise<void> {
    try {
      await Promise.all([this.settings.load(), this.transactions.load()]);
      this.loadFailed.set(false);
    } catch {
      this.loadFailed.set(true);
    }
  }

  /** Reads bank exports and adds their transactions. Importing real files ends the demo. */
  async importFiles(files: readonly File[]): Promise<ImportReport> {
    if (this.transactions.isDemo()) await this.leaveDemo();

    const errors: string[] = [];
    let added = 0;
    let duplicates = 0;
    for (const file of files) {
      let parsed: BankTransaction[];
      try {
        parsed = parseBankExport(parseCsv(decodeText(await file.arrayBuffer())), file.name);
      } catch (error) {
        errors.push(
          error instanceof UnsupportedExportError
            ? error.message
            : `${file.name}: kon dit bestand niet lezen.`,
        );
        continue;
      }
      try {
        const result = await this.transactions.add(parsed);
        added += result.added;
        duplicates += result.duplicates;
      } catch {
        errors.push(`${file.name}: ingelezen, maar opslaan is mislukt.`);
      }
    }
    return { added, duplicates, errors };
  }

  /** Shows generated example data; nothing the user changes is stored. */
  loadDemo(): void {
    const today = this.clock();
    const rows = parseCsv(generateDemoExport(today));
    this.view.reset();
    this.settings.useDemo(createDemoSettings(today));
    this.transactions.useDemo(parseBankExport(rows, 'voorbeeld-rabobank.csv'));
  }

  async leaveDemo(): Promise<void> {
    this.view.reset();
    try {
      await Promise.all([this.settings.useStored(), this.transactions.useStored()]);
      this.loadFailed.set(false);
    } catch {
      this.loadFailed.set(true);
    }
  }

  /** Removes the imported transactions. Settings (names, categories, plan, pots) are kept. */
  async startOver(): Promise<void> {
    if (this.transactions.isDemo()) {
      await this.leaveDemo();
      return;
    }
    this.view.reset();
    try {
      await this.transactions.clear();
    } catch {
      // `storageProblem` reports the failure.
    }
  }
}
