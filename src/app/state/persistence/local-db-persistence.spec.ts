import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS } from '../../core/models/settings';
import { bankTx } from '../../core/testing/builders';
import { LocalDbPersistence } from './local-db-persistence';

describe('LocalDbPersistence', () => {
  let persistence: LocalDbPersistence;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    persistence = TestBed.inject(LocalDbPersistence);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads transactions from the API and drops malformed rows', async () => {
    const tx = bankTx({ id: 'a' });
    const loaded = persistence.loadTransactions();
    http.expectOne({ method: 'GET', url: '/api/transactions' }).flush([tx, { id: 'kapot' }]);
    expect(await loaded).toEqual([tx]);
  });

  it('posts new transactions and skips the request when there are none', async () => {
    const tx = bankTx({ id: 'a' });
    const saved = persistence.addTransactions([tx]);
    const request = http.expectOne({ method: 'POST', url: '/api/transactions' });
    expect(request.request.body).toEqual([tx]);
    request.flush({ added: 1, duplicates: 0 });
    await saved;

    await persistence.addTransactions([]);
    http.expectNone('/api/transactions');
  });

  it('clears transactions and reads and writes settings', async () => {
    const cleared = persistence.clearTransactions();
    http.expectOne({ method: 'DELETE', url: '/api/transactions' }).flush({ deleted: 3 });
    await cleared;

    const stored = persistence.loadSettings();
    http.expectOne({ method: 'GET', url: '/api/settings' }).flush(null);
    expect(await stored).toBeNull();

    const saved = persistence.saveSettings(DEFAULT_SETTINGS);
    const put = http.expectOne({ method: 'PUT', url: '/api/settings' });
    expect(put.request.body).toEqual(DEFAULT_SETTINGS);
    put.flush({ ok: true });
    await saved;
  });

  it('rejects when the API is not reachable', async () => {
    const loaded = persistence.loadTransactions();
    http
      .expectOne('/api/transactions')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await expect(loaded).rejects.toBeTruthy();
  });
});
