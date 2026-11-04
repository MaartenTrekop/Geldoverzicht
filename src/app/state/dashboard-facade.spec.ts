import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../testing/test-setup';
import { DashboardFacade } from './dashboard-facade';
import { SettingsStore } from './settings-store';
import { TransactionsStore } from './transactions-store';
import { Workspace } from './workspace';

describe('DashboardFacade with the demo data', () => {
  let facade: DashboardFacade;

  beforeEach(() => {
    configureTestBed();
    TestBed.inject(Workspace).loadDemo();
    facade = TestBed.inject(DashboardFacade);
  });

  it('opens on the last complete month', () => {
    const period = facade.periodVm();
    expect(period.mode).toBe('month');
    expect(period.month).toBe('2026-10');
    expect(period.canGoForward).toBe(true);
    expect(period.isRunningMonth).toBe(false);
  });

  it('reports income from both salaries and compares with the average', () => {
    const kpis = facade.kpis();
    expect(kpis.totals.income).toBeCloseTo(5598.15);
    expect(kpis.average).not.toBeNull();
  });

  it("counts the horse account as the second person's own money", () => {
    const [, , person2] = facade.budget().lines;
    expect(person2.categories[0]).toEqual({ name: 'Paard', amount: 400 });
  });

  it('recognises the mortgage as a shared fixed cost', () => {
    const mortgage = facade.fixedCosts().items.find((f) => f.name === 'Rabobank Hypotheken');
    expect(mortgage).toMatchObject({ owner: 'shared', paid: 1268.32 });
  });

  it('expects the salaries that have not arrived in the running month', () => {
    facade.stepMonth(1);
    expect(facade.periodVm().isRunningMonth).toBe(true);
    expect(facade.kpis().expectedIncome).toBeCloseTo(5598.15);
  });

  it('filters the transaction table and pages through it', () => {
    facade.updateTable({ category: 'Boodschappen' });
    const table = facade.transactionTable();
    expect(table.rows.length).toBeGreaterThan(0);
    expect(table.rows.every((t) => t.category === 'Boodschappen')).toBe(true);
  });

  it('reads the buffer pot balance from the exported savings account', () => {
    const buffer = facade.pots().find((p) => p.pot.name === 'Buffer');
    expect(buffer?.balance.source).toBe('export');
    expect(buffer?.balance.amount).toBeGreaterThan(8500);
  });

  it('applies a category to every transaction of a counterparty', () => {
    const tx = facade.ledger().transactions.find((t) => t.counterpartyName === 'Decathlon');
    expect(tx).toBeDefined();
    const count = facade.setCategory(tx!, 'Vrije tijd & reizen', 'counterparty');
    const decathlon = facade.ledger().transactions.filter((t) => t.key === tx!.key);
    expect(count).toBe(decathlon.length);
    expect(decathlon.every((t) => t.category === 'Vrije tijd & reizen')).toBe(true);
  });

  it('does not store anything while the demo is shown', () => {
    expect(TestBed.inject(TransactionsStore).isDemo()).toBe(true);
    TestBed.inject(SettingsStore).update((s) => ({ ...s, personNames: ['A', 'B'] }));
    TestBed.tick();
    expect(localStorage.getItem('geldoverzicht.settings.v1')).toBeNull();
    expect(localStorage.getItem('geldoverzicht.transactions.v1')).toBeNull();
  });
});
