import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS } from '../../core/models/settings';
import { bankTx } from '../../core/testing/builders';
import { BrowserPersistence, SETTINGS_KEY, TRANSACTIONS_KEY } from './browser-persistence';
import { BrowserStorage } from './browser-storage';

describe('BrowserPersistence', () => {
  beforeEach(() => localStorage.clear());

  it('adds transactions to what is stored, without duplicates', async () => {
    const persistence = TestBed.inject(BrowserPersistence);
    await persistence.addTransactions([bankTx({ id: 'a' }), bankTx({ id: 'b' })]);
    await persistence.addTransactions([bankTx({ id: 'b' }), bankTx({ id: 'c' })]);

    expect((await persistence.loadTransactions()).map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(JSON.parse(localStorage.getItem(TRANSACTIONS_KEY)!)).toHaveLength(3);

    await persistence.clearTransactions();
    expect(await persistence.loadTransactions()).toEqual([]);
  });

  it('stores settings', async () => {
    const persistence = TestBed.inject(BrowserPersistence);
    expect(await persistence.loadSettings()).toBeNull();
    await persistence.saveSettings(DEFAULT_SETTINGS);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects when the browser refuses to store (storage full)', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BrowserStorage,
          useValue: { read: () => null, write: () => false, remove: () => {} },
        },
      ],
    });
    const persistence = TestBed.inject(BrowserPersistence);
    await expect(persistence.addTransactions([bankTx()])).rejects.toBeInstanceOf(Error);
    await expect(persistence.saveSettings(DEFAULT_SETTINGS)).rejects.toBeInstanceOf(Error);
  });
});
