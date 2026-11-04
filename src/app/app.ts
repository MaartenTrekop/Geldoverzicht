import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { ImportFlow } from './features/import/import-flow';
import { FilePickerButton } from './shared/ui/file-picker-button';
import { ModalDialog } from './shared/ui/modal-dialog';
import { ToastOutlet, ToastService } from './shared/ui/toast';
import { Workspace } from './state/workspace';

/** App shell: header with file actions, the routed page and global toasts. */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, FilePickerButton, ModalDialog, ToastOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    // Dropping a file next to the drop zone must not make the browser open it.
    '(window:dragover)': '$event.preventDefault()',
    '(window:drop)': '$event.preventDefault()',
  },
})
export class App {
  protected readonly workspace = inject(Workspace);
  protected readonly importFlow = inject(ImportFlow);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly confirmingStartOver = signal(false);

  protected async leaveDemo(): Promise<void> {
    this.workspace.leaveDemo();
    await this.router.navigate([this.workspace.hasData() ? '/overzicht' : '/']);
  }

  protected async startOver(): Promise<void> {
    this.confirmingStartOver.set(false);
    this.workspace.startOver();
    this.toast.show('Transacties verwijderd');
    await this.router.navigate(['/']);
  }
}
