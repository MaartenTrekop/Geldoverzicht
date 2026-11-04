import { TestBed } from '@angular/core/testing';
import { KpiVm } from '../../../state/dashboard-view-models';
import { configureTestBed, textOf } from '../../../testing/test-setup';
import { KpiSummary } from './kpi-summary';

const month: KpiVm = {
  isMonth: true,
  isRunningMonth: false,
  monthCount: 1,
  totals: { income: 5000, expenses: 3500, savings: 500 },
  leftover: 1000,
  average: { income: 5000, expenses: 3200, savings: 500, leftover: 1300 },
  expectedIncome: 0,
};

async function render(kpis: KpiVm) {
  const fixture = TestBed.createComponent(KpiSummary);
  fixture.componentRef.setInput('kpis', kpis);
  await fixture.whenStable();
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll('article')].map(textOf);
}

describe('KpiSummary', () => {
  beforeEach(() => configureTestBed([KpiSummary]));

  it('compares a finished month with the average', async () => {
    const [income, expenses, savings, leftover] = await render(month);
    expect(income).toContain('€ 5.000');
    expect(income).toContain('gelijk aan gemiddeld');
    expect(expenses).toContain('€ 300 meer dan gemiddeld (€ 3.200)');
    expect(savings).toContain('10% van inkomen');
    expect(leftover).toContain('€ 300 minder dan gemiddeld');
  });

  it('shows expected income for the running month', async () => {
    const [income, expenses] = await render({
      ...month,
      isRunningMonth: true,
      expectedIncome: 2400,
    });
    expect(income).toContain('tot nu toe · nog verwacht € 2.400');
    expect(expenses).toContain('tot nu toe');
  });

  it('shows monthly averages for a range', async () => {
    const [income] = await render({ ...month, isMonth: false, monthCount: 2, average: null });
    expect(income).toContain('gem. € 2.500 per maand');
  });
});
