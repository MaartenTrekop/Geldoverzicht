import { TestBed } from '@angular/core/testing';
import { BudgetSplit } from '../../../core/analysis/budget-split';
import { configureTestBed, textOf } from '../../../testing/test-setup';
import { BudgetSplitCard } from './budget-split';

const split: BudgetSplit = {
  income: {
    received: 5000,
    expected: 0,
    total: 5000,
    byOwner: { shared: 0, person1: 3000, person2: 2000 },
    expectedSources: [],
  },
  sharedFixed: 1000,
  sharedFixedPending: 0,
  household: { actual: 600, average: 650, budget: 650, isCustom: false },
  free: 3350,
  lines: [
    { line: 'savings', value: 40, planned: 1340, actual: 500, categories: [] },
    { line: 'person1', value: 30, planned: 1005, actual: 0, categories: [] },
    {
      line: 'person2',
      value: 30,
      planned: 1005,
      actual: 1200,
      categories: [{ name: 'Paard', amount: 1200 }],
    },
  ],
  unallocated: 0,
  unallocatedPercent: 0,
  potsMonthly: 0,
};

describe('BudgetSplitCard', () => {
  beforeEach(() => configureTestBed([BudgetSplitCard]));

  async function render() {
    const fixture = TestBed.createComponent(BudgetSplitCard);
    fixture.componentRef.setInput('split', split);
    fixture.componentRef.setInput('mode', 'percent');
    fixture.componentRef.setInput('names', ['Maarten', 'Wendy']);
    fixture.componentRef.setInput('heading', 'Verdeling oktober 2026');
    await fixture.whenStable();
    return fixture;
  }

  it('shows the free budget and each line with its status', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const free = textOf(element.querySelector('.free'));
    expect(free).toContain('Vrije ruimte');
    expect(free).toContain('€ 3.350');
    const rows = [...element.querySelectorAll('tbody tr')].map(textOf);
    expect(rows[0]).toContain('€ 840 onder plan');
    expect(rows[1]).toContain('Eigen geld Maarten');
    expect(rows[2]).toContain('Paard € 1.200');
    expect(rows[2]).toContain('€ 195 over budget');
  });

  it('emits a changed plan value', async () => {
    const fixture = await render();
    const changes: unknown[] = [];
    fixture.componentInstance.valueChange.subscribe((c) => changes.push(c));

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'tbody input',
    )!;
    input.value = '50';
    input.dispatchEvent(new Event('change'));

    expect(changes).toEqual([{ line: 'savings', value: 50 }]);
  });

  it('lets a category chip filter the transactions of that person', async () => {
    const fixture = await render();
    const selected: unknown[] = [];
    fixture.componentInstance.categorySelect.subscribe((c) => selected.push(c));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.pill')!.click();

    expect(selected).toEqual([{ category: 'Paard', owner: 'person2' }]);
  });
});
