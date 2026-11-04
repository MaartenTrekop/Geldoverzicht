import { Directive, output, signal } from '@angular/core';

/** Turns an element into a drop target for files; adds the `dragging` class while hovering. */
@Directive({
  selector: '[appFileDrop]',
  host: {
    '[class.dragging]': 'dragging()',
    '(dragenter)': 'enter($event)',
    '(dragover)': 'enter($event)',
    '(dragleave)': 'leave($event)',
    '(drop)': 'drop($event)',
  },
})
export class FileDrop {
  readonly filesDropped = output<File[]>();
  protected readonly dragging = signal(false);

  protected enter(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected leave(event: DragEvent): void {
    const target = event.currentTarget as Node | null;
    if (
      !target ||
      !(event.relatedTarget instanceof Node) ||
      !target.contains(event.relatedTarget)
    ) {
      this.dragging.set(false);
    }
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) this.filesDropped.emit(files);
  }
}
