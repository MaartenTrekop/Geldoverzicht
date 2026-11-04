import { TestBed } from '@angular/core/testing';
import { ChartVm } from '../../../state/dashboard-view-models';
import { configureTestBed } from '../../../testing/test-setup';
import { MonthChart } from './month-chart';

const chart: ChartVm = {
  points: [
    { month: '2026-08', income: 5000, expenses: 3000, leftover: 1500 },
    { month: '2026-09', income: 5000, expenses: 4000, leftover: 500 },
    { month: '2026-10', income: 5200, expenses: 5800, leftover: -900 },
  ],
  selected: ['2026-10'],
  highlightSelection: true,
};

describe('MonthChart', () => {
  beforeEach(() => configureTestBed([MonthChart]));

  it('draws a bar group per month and highlights the selected month', async () => {
    const fixture = TestBed.createComponent(MonthChart);
    fixture.componentRef.setInput('chart', chart);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const months = element.querySelectorAll('g.month');
    expect(months).toHaveLength(3);
    expect(months[2].classList.contains('selected')).toBe(true);
    expect(months[0].classList.contains('dimmed')).toBe(true);
    expect(element.querySelectorAll('circle.dot')).toHaveLength(3);
  });

  it('emits the month that is clicked', async () => {
    const fixture = TestBed.createComponent(MonthChart);
    fixture.componentRef.setInput('chart', chart);
    await fixture.whenStable();
    const selected: string[] = [];
    fixture.componentInstance.monthSelected.subscribe((m) => selected.push(m));

    (fixture.nativeElement as HTMLElement)
      .querySelectorAll('g.month')[1]
      .dispatchEvent(new MouseEvent('click'));

    expect(selected).toEqual(['2026-09']);
  });
});
