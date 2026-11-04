import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ProgressTone = 'income' | 'expense' | 'savings' | 'neutral';

/** Thin horizontal bar; `value` is a fraction (0–1) and is clamped. */
@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'percent()',
    '[style.height.px]': 'height()',
  },
  template: `<div class="fill" [class]="tone()" [style.width.%]="percent()"></div>`,
  styles: `
    :host {
      display: block;
      background: var(--chip);
      border-radius: 4px;
      overflow: hidden;
    }
    .fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.2s ease;
    }
    .income {
      background: var(--income);
    }
    .expense {
      background: var(--expense);
    }
    .savings {
      background: var(--savings);
    }
    .neutral {
      background: var(--muted);
    }
  `,
})
export class ProgressBar {
  readonly value = input.required<number>();
  readonly tone = input<ProgressTone>('neutral');
  readonly height = input(6);
  protected readonly percent = computed(() =>
    Math.round(Math.max(0, Math.min(1, this.value())) * 100),
  );
}
