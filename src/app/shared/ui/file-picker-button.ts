import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** A button that opens the file chooser for CSV exports. */
@Component({
  selector: 'app-file-picker-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn" [class.primary]="primary()" (click)="picker.click()">
      <ng-content />
    </button>
    <input
      #picker
      type="file"
      accept=".csv,.txt,text/csv"
      multiple
      hidden
      (change)="pick(picker)"
    />
  `,
})
export class FilePickerButton {
  readonly primary = input(false);
  readonly filesSelected = output<File[]>();

  protected pick(picker: HTMLInputElement): void {
    const files = Array.from(picker.files ?? []);
    picker.value = '';
    if (files.length) this.filesSelected.emit(files);
  }
}
