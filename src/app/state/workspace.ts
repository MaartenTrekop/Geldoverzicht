import { Injectable, inject } from '@angular/core';
import { UnsupportedExportError, parseBankExport } from '../core/import/bank-export';
import { decodeText, parseCsv } from '../core/import/csv';
import { createDemoSettings, generateDemoExport } from '../core/demo/demo-export';
import { CLOCK } from './clock';
import { SettingsStore } from './settings-store';
import { TransactionsStore } from './transactions-store';
import { ViewStore } from './view-store';

export interface ImportReport {
  readonly added: number;
  readonly duplicates: number;
  readonly errors: readonly string[];
}

/** Use cases that span several stores: importing files, the demo and starting over. */
@Injectable({ providedIn: 'root' })
export class Workspace {
  private readonly transactions = inject(TransactionsStore);
  private readonly settings = inject(SettingsStore);
  private readonly view = inject(ViewStore);
  private readonly clock = inject(CLOCK);

  readonly hasData = this.transactions.hasData;
  readonly isDemo = this.transactions.isDemo;
  readonly notPersisted = this.transactions.notPersisted;

  /** Reads bank exports and adds their transactions. Importing real files ends the demo. */
  async importFiles(files: readonly File[]): Promise<ImportReport> {
    if (this.transactions.isDemo()) this.leaveDemo();

    const errors: string[] = [];
    let added = 0;
    let duplicates = 0;
    for (const file of files) {
      try {
        const rows = parseCsv(decodeText(await file.arrayBuffer()));
        const result = this.transactions.add(parseBankExport(rows, file.name));
        added += result.added;
        duplicates += result.duplicates;
      } catch (error) {
        errors.push(
          error instanceof UnsupportedExportError
            ? error.message
            : `${file.name}: kon dit bestand niet lezen.`,
        );
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

  leaveDemo(): void {
    this.view.reset();
    this.settings.useStored();
    this.transactions.useStored();
  }

  /** Removes the imported transactions. Settings (names, categories, plan, pots) are kept. */
  startOver(): void {
    this.view.reset();
    if (this.transactions.isDemo()) this.settings.useStored();
    this.transactions.clear();
  }
}
