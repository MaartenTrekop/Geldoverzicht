import { TestBed } from '@angular/core/testing';
import { Workspace } from '../../state/workspace';
import { configureTestBed, textOf } from '../../testing/test-setup';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  beforeEach(() => {
    configureTestBed([DashboardPage]);
    TestBed.inject(Workspace).loadDemo();
  });

  async function render() {
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    return fixture;
  }

  it('renders every section for the demo data', async () => {
    const element = (await render()).nativeElement as HTMLElement;

    for (const selector of [
      'app-period-toolbar',
      'app-kpi-summary',
      'app-budget-split',
      'app-savings-pots',
      'app-month-chart',
      'app-fixed-costs',
      'app-own-accounts',
      'app-transaction-table',
    ]) {
      expect(element.querySelector(selector)).not.toBeNull();
    }
    expect(textOf(element.querySelector('app-budget-split h2'))).toBe('Verdeling oktober 2026');
    expect(element.querySelectorAll('app-pot-card')).toHaveLength(3);
    const accountNames = [
      ...element.querySelectorAll<HTMLInputElement>('app-own-accounts input'),
    ].map((i) => i.value);
    expect(accountNames).toContain('Paardrekening');
  });

  it('moves to the next month with the arrow button', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('button[aria-label="Volgende maand"]')!.click();
    await fixture.whenStable();

    expect(textOf(element.querySelector('app-budget-split h2'))).toBe('Verdeling november 2026');
    expect(textOf(element.querySelector('app-period-toolbar'))).toContain('lopende maand');
  });

  it('filters the table when a category is clicked', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const row = [
      ...element.querySelectorAll<HTMLButtonElement>('app-category-breakdown button'),
    ].find((b) => textOf(b).startsWith('Boodschappen'))!;

    row.click();
    await fixture.whenStable();

    const categories = [
      ...element.querySelectorAll('app-transaction-table tbody app-category-select select'),
    ].map((s) => (s as HTMLSelectElement).value);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((c) => c === 'Boodschappen')).toBe(true);
  });
});
