import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

/** Short confirmation messages ("12 transacties → Paard"). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly current = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly message = this.current.asReadonly();

  show(message: string, durationMs = 2600): void {
    clearTimeout(this.timer);
    this.current.set(message);
    this.timer = setTimeout(() => this.current.set(null), durationMs);
  }
}

@Component({
  selector: 'app-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-live': 'polite' },
  template: `
    @if (toast.message(); as message) {
      <div class="toast">{{ message }}</div>
    }
  `,
  styles: `
    .toast {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translateX(-50%);
      background: var(--accent);
      color: var(--bg);
      padding: 9px 16px;
      border-radius: 10px;
      font-size: 13.5px;
      max-width: calc(100vw - 32px);
      z-index: 20;
    }
  `,
})
export class ToastOutlet {
  protected readonly toast = inject(ToastService);
}
