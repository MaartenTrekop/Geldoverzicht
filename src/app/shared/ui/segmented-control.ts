import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SegmentOption {
  readonly value: string;
  readonly label: string;
}

/** A row of mutually exclusive buttons, e.g. Maand | Periode or % | €. */
@Component({
  selector: 'app-segmented-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': 'label()', '[class.large]': 'large()' },
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        [class.on]="option.value === value()"
        [attr.aria-pressed]="option.value === value()"
        (click)="value.set(option.value)"
      >
        {{ option.label }}
      </button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: var(--card);
    }
    button {
      background: transparent;
      border: 0;
      padding: 3px 10px;
      cursor: pointer;
      font-size: 12.5px;
      color: var(--muted);
    }
    :host(.large) button {
      padding: 7px 14px;
      font-size: 14px;
    }
    button.on {
      background: var(--accent);
      color: var(--bg);
    }
  `,
})
export class SegmentedControl {
  readonly options = input.required<readonly SegmentOption[]>();
  readonly value = model.required<string>();
  readonly label = input('');
  readonly large = input(false);
}
