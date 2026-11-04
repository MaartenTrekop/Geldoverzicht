import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

let nextId = 0;

/**
 * Modal built on the native `<dialog>` element (focus trap, Escape and backdrop for free).
 * Controlled through `open`; emits `closed` however it was closed.
 */
@Component({
  selector: 'app-modal-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      [attr.aria-labelledby]="titleId"
      (close)="closed.emit()"
      (click)="closeOnBackdrop($event)"
    >
      <div class="box">
        <h2 [id]="titleId">{{ heading() }}</h2>
        <ng-content />
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 0;
      width: min(460px, calc(100vw - 32px));
      background: var(--card);
      color: var(--ink);
    }
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.35);
    }
    .box {
      padding: 20px;
    }
    h2 {
      font-size: 17px;
      margin: 0 0 4px;
    }
  `,
})
export class ModalDialog {
  readonly heading = input.required<string>();
  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly titleId = `dialog-title-${nextId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open() && !element.open) {
        if (typeof element.showModal === 'function') element.showModal();
        else element.setAttribute('open', '');
      } else if (!this.open() && element.open) {
        if (typeof element.close === 'function') element.close();
        else element.removeAttribute('open');
      }
    });
  }

  protected closeOnBackdrop(event: MouseEvent): void {
    const element = this.dialog().nativeElement;
    if (event.target === element && typeof element.close === 'function') element.close();
  }
}
