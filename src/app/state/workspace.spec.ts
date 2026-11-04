import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../testing/test-setup';
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

describe('Workspace', () => {
  let workspace: Workspace;

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

  it('keeps imported transactions in browser storage', async () => {
    await workspace.importFiles([fakeFile('rabo.csv', RABOBANK_CSV)]);
    TestBed.tick();
    const stored = JSON.parse(localStorage.getItem('geldoverzicht.transactions.v1') ?? '[]');
    expect(stored).toHaveLength(2);
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
    workspace.startOver();
    expect(workspace.hasData()).toBe(false);
  });
});
