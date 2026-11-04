import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FileDrop } from '../../shared/ui/file-drop';
import { FilePickerButton } from '../../shared/ui/file-picker-button';
import { ImportFlow } from './import-flow';

/** Landing page: drop a Rabobank export or look around with demo data. */
@Component({
  selector: 'app-import-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FileDrop, FilePickerButton],
  templateUrl: './import-page.html',
  styleUrl: './import-page.scss',
})
export class ImportPage {
  protected readonly flow = inject(ImportFlow);
}
