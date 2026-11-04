import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { YearMonth, formatMonthAxis } from '../../../core/period/months';
import { formatEuro } from '../../../shared/format/format';
import { EuroPipe, MonthLabelPipe } from '../../../shared/format/pipes';
import { ChartVm } from '../../../state/dashboard-view-models';

const HEIGHT = 280;
const PAD = { left: 64, right: 8, top: 10, bottom: 26 };

interface Bar {
  readonly month: YearMonth;
  readonly x: number;
  readonly width: number;
  readonly incomeY: number;
  readonly incomeHeight: number;
  readonly expensesY: number;
  readonly expensesHeight: number;
  readonly center: number;
  readonly leftoverY: number;
  readonly label: string | null;
  readonly selected: boolean;
  readonly dimmed: boolean;
}

/** Income and expense bars per month with a line for what is left; click a month to open it. */
@Component({
  selector: 'app-month-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EuroPipe, MonthLabelPipe],
  templateUrl: './month-chart.html',
  styleUrl: './month-chart.scss',
})
export class MonthChart {
  readonly chart = input.required<ChartVm>();
  readonly monthSelected = output<YearMonth>();

  protected readonly width = signal(640);
  protected readonly height = HEIGHT;
  protected readonly hovered = signal<number | null>(null);

  protected readonly geometry = computed(() => {
    const { points, selected, highlightSelection } = this.chart();
    const width = Math.max(320, this.width());
    const innerWidth = width - PAD.left - PAD.right;
    const innerHeight = HEIGHT - PAD.top - PAD.bottom;

    let max = Math.max(1, ...points.map((p) => Math.max(p.income, p.expenses, p.leftover)));
    let min = Math.min(0, ...points.map((p) => p.leftover));
    const step = niceStep((max - min) / 4);
    max = Math.ceil(max / step) * step;
    min = Math.floor(min / step) * step;
    const y = (value: number) =>
      PAD.top + innerHeight - ((value - min) / (max - min)) * innerHeight;

    const ticks: { y: number; label: string; zero: boolean }[] = [];
    for (let value = min; value <= max + 1e-6; value += step) {
      ticks.push({ y: y(value), label: formatEuro(value), zero: Math.abs(value) < 1e-6 });
    }

    const groupWidth = innerWidth / Math.max(1, points.length);
    const barWidth = Math.min(16, groupWidth * 0.32);
    const labelEvery = Math.ceil(points.length / 12);
    const chosen = new Set(selected);
    const bars: Bar[] = points.map((p, i) => {
      const center = PAD.left + groupWidth * i + groupWidth / 2;
      return {
        month: p.month,
        x: PAD.left + groupWidth * i,
        width: groupWidth,
        incomeY: y(Math.max(0, p.income)),
        incomeHeight: Math.abs(y(p.income) - y(0)),
        expensesY: y(Math.max(0, p.expenses)),
        expensesHeight: Math.abs(y(p.expenses) - y(0)),
        center,
        leftoverY: y(p.leftover),
        label: i % labelEvery === 0 ? formatMonthAxis(p.month) : null,
        selected: highlightSelection && chosen.has(p.month),
        dimmed: highlightSelection && !chosen.has(p.month),
      };
    });

    return {
      width,
      innerHeight,
      barWidth,
      ticks,
      bars,
      line: bars.map((b) => `${b.center},${b.leftoverY}`).join(' '),
    };
  });

  protected readonly tooltip = computed(() => {
    const index = this.hovered();
    if (index === null) return null;
    const point = this.chart().points[index];
    const bar = this.geometry().bars[index];
    if (!point || !bar) return null;
    return { point, left: Math.min(Math.max(0, bar.center - 70), this.geometry().width - 150) };
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.width.set(host.clientWidth || 640);
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) =>
        this.width.set(entry.contentRect.width || 640),
      );
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}

/** A round axis step (1, 2, 2.5, 5 × 10ⁿ) of at least `raw`. */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  return [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
}
