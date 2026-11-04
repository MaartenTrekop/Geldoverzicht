import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Settings } from '../core/models/settings';
import { BankTransaction } from '../core/models/transaction';
import { configureTestBed } from '../testing/test-setup';
import { Persistence, PERSISTENCE } from './persistence/persistence';
import { SettingsStore } from './settings-store';
import { TransactionsStore } from './transactions-store';
import { Workspace } from './workspace';

const RABOBANK_CSV = [
  '"IBAN/BBAN","Munt","BIC","Volgnr","Datum","Rentedatum","Bedrag","Saldo na trn","Tegenrekening IBAN/BBAN","Naam tegenpartij","Code","Omschrijving-1"',
  '"NL11RABO0123456789","EUR","RABONL2U","000000000000000001","2026-10-01","2026-10-01","-1268,32","+3000,00","NL44RABO0300000001","Rabobank Hypotheken","ei","Hypotheek"',
  '"NL11RABO0123456789","EUR","RABONL2U","000000000000000002","2026-10-03","2026-10-03","-45,10","+2954,90","","Albert Heijn 1352","bc","Apple Pay"',
].join('\n');

/** A File-like object; jsdom's File does not implement `arrayBuffer()` everywhere. */
function fakeFile(name: string, content: string): File {
  const bytes = new TextEncoder().encode(content);
  return { name, arrayBuffer: async () => bytes.buffer } as unknown as File;
}

/** In-memory persistence that can be told to fail, to test error handling. */
class FakePersistence implements Persistence {
  readonly kind = 'local-db' as const;
  reachable = true;
  transactions: BankTransaction[] = [];
  settings: unknown = null;
  savedSettings: Settings[] = [];

  private check(): void {
    if (!this.reachable) throw new Error('niet bereikbaar');
  }
  async loadTransactions() {
    this.check();
    return [...this.transactions];
  }
  async addTransactions(list: readonly BankTransaction[]) {
    this.check();
    this.transactions.push(...list);
  }
  async clearTransactions() {
    this.check();
    this.transactions = [];
  }
  async loadSettings() {
    this.check();
    return this.settings;
  }
  async saveSettings(settings: Settings) {
    this.check();
    this.savedSettings.push(settings);
  }
}

describe('Workspace', () => {
  let workspace: Workspace;

  describe('with browser storage', () => {
    beforeEach(() => {
      configureTestBed();
      workspace = TestBed.inject(Workspace);
    });

    it('imports a Rabobank export and skips duplicates on a second import', async () => {
      const first = await workspace.importFiles([fakeFile('rabo.csv', RABOBANK_CSV)]);
      const second = await workspace.importFiles([fakeFile('rabo.csv', RABOBANK_CSV)]);

      expect(first).toEqual({ added: 2, duplicates: 0, errors: [] });
      expect(second).toEqual({ added: 0, duplicates: 2, errors: [] });
      expect(TestBed.inject(TransactionsStore).transactions()).toHaveLength(2);
    });

    it('reports files that are not bank exports', async () => {
      const report = await workspace.importFiles([fakeFile('lijst.csv', 'naam,leeftijd\nAnna,4')]);
      expect(report.added).toBe(0);
      expect(report.errors[0]).toContain('lijst.csv');
    });

    it('keeps imported transactions in browser storage and loads them again', async () => {
      await workspace.importFiles([fakeFile('rabo.csv', RABOBANK_CSV)]);
      const stored = JSON.parse(localStorage.getItem('geldoverzicht.transactions.v1') ?? '[]');
      expect(stored).toHaveLength(2);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const reloaded = TestBed.inject(Workspace);
      await reloaded.load();
      expect(reloaded.hasData()).toBe(true);
      expect(reloaded.storageProblem()).toBeNull();
    });

    it('replaces the demo when real files are imported', async () => {
      workspace.loadDemo();
      expect(workspace.isDemo()).toBe(true);

      await workspace.importFiles([fakeFile('rabo.csv', RABOBANK_CSV)]);

      expect(workspace.isDemo()).toBe(false);
      expect(TestBed.inject(TransactionsStore).transactions()).toHaveLength(2);
    });

    it('starts over by removing the transactions', async () => {
      await workspace.importFiles([fakeFile('rabo.csv', RABOBANK_CSV)]);
      await workspace.startOver();
      expect(workspace.hasData()).toBe(false);
      expect(localStorage.getItem('geldoverzicht.transactions.v1')).toBeNull();
    });
  });

  describe('with the local database', () => {
    let fake: FakePersistence;

    beforeEach(() => {
      fake = new FakePersistence();
      configureTestBed();
      TestBed.configureTestingModule({ providers: [{ provide: PERSISTENCE, useValue: fake }] });
      workspace = TestBed.inject(Workspace);
    });

    it('tells how to start the database when it cannot be reached', async () => {
      fake.reachable = false;
      await workspace.load();
      expect(workspace.storageProblem()).toContain('npm run api');
    });

    it('never saves settings when loading failed, so nothing stored is overwritten', async () => {
      fake.reachable = false;
      await workspace.load();
      fake.reachable = true;
      TestBed.inject(SettingsStore).update((s) => ({ ...s, personNames: ['A', 'B'] }));
      TestBed.tick();
      await Promise.resolve();
      expect(fake.savedSettings).toEqual([]);
    });

    it('saves settings after a successful load, but not demo settings', async () => {
      fake.settings = { ...DEFAULT_SETTINGS, personNames: ['Anna', 'Bram'] };
      await workspace.load();
      const store = TestBed.inject(SettingsStore);
      expect(store.settings().personNames).toEqual(['Anna', 'Bram']);

      workspace.loadDemo();
      store.update((s) => ({ ...s, personNames: ['Demo', 'Demo'] }));
      TestBed.tick();
      await workspace.leaveDemo();
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve));

      expect(store.settings().personNames).toEqual(['Anna', 'Bram']);
      expect(fake.savedSettings.every((s) => s.personNames[0] !== 'Demo')).toBe(true);
    });

    it('stores imported transactions in the database and reports failures', async () => {
      await workspace.load();
      await workspace.importFiles([fakeFile('rabo.csv', RABOBANK_CSV)]);
      expect(fake.transactions).toHaveLength(2);

      fake.reachable = false;
      const report = await workspace.importFiles([
        fakeFile('nieuw.csv', RABOBANK_CSV.replaceAll('00000000000000000', '10000000000000000')),
      ]);
      expect(report.errors[0]).toContain('opslaan is mislukt');
      expect(workspace.storageProblem()).toContain('mislukt');
    });
  });
});
