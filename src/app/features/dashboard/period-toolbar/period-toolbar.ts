import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PersonNames } from '../../../core/models/owner';
import { YearMonth } from '../../../core/period/months';
import { QuickRange, ViewMode } from '../../../core/period/period';
import { MonthLabelPipe } from '../../../shared/format/pipes';
import { OwnerSelect } from '../../../shared/ui/owner-select';
import { SegmentedControl, SegmentOption } from '../../../shared/ui/segmented-control';
import { PeriodVm } from '../../../state/dashboard-view-models';

/** Month navigation or range selection, plus account and person filters. */
@Component({
  selector: 'app-period-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SegmentedControl, OwnerSelect, MonthLabelPipe],
  templateUrl: './period-toolbar.html',
  styleUrl: './period-toolbar.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class PeriodToolbar {
  readonly period = input.required<PeriodVm>();
  readonly names = input.required<PersonNames>();
  readonly owner = input.required<string>();

  readonly modeChange = output<ViewMode>();
  readonly monthChange = output<YearMonth>();
  readonly step = output<-1 | 1>();
  readonly rangeChange = output<{ from: YearMonth; to: YearMonth }>();
  readonly quickRange = output<QuickRange>();
  readonly accountChange = output<string>();
  readonly ownerChange = output<string>();

  protected readonly modes: SegmentOption[] = [
    { value: 'month', label: 'Maand' },
    { value: 'range', label: 'Periode' },
  ];

  protected readonly newestFirst = computed(() => [...this.period().available].reverse());

  protected readonly summary = computed(() => {
    const p = this.period();
    const count = `${p.transactionCount} transacties`;
    if (p.mode === 'month') return p.isRunningMonth ? `${count} · lopende maand` : count;
    return `${count} · ${p.monthCount} ${p.monthCount === 1 ? 'maand' : 'maanden'}`;
  });

  protected setMode(mode: string): void {
    this.modeChange.emit(mode === 'range' ? 'range' : 'month');
  }

  protected setRange(from: string, to: string): void {
    this.rangeChange.emit({ from, to });
  }

  /** Left/right arrow keys browse months, unless the user is typing or choosing. */
  protected onKeydown(event: KeyboardEvent): void {
    if (this.period().mode !== 'month' || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, select, textarea, dialog')) return;
    if (event.key === 'ArrowLeft' && this.period().canGoBack) this.step.emit(-1);
    if (event.key === 'ArrowRight' && this.period().canGoForward) this.step.emit(1);
  }
}
