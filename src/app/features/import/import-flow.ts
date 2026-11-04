import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Workspace } from '../../state/workspace';
import { ToastService } from '../../shared/ui/toast';

/** UI flow around importing: reports the result and opens the overview. */
@Injectable({ providedIn: 'root' })
export class ImportFlow {
  private readonly workspace = inject(Workspace);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private readonly errorState = signal<readonly string[]>([]);
  /** Problems with the last imported files. */
  readonly errors = this.errorState.asReadonly();

  async importFiles(files: readonly File[]): Promise<void> {
    const report = await this.workspace.importFiles(files);
    this.errorState.set(report.errors);
    if (report.added || report.duplicates) {
      const duplicates = report.duplicates ? ` · ${report.duplicates} dubbele overgeslagen` : '';
      this.toast.show(`${report.added} transacties ingelezen${duplicates}`);
      await this.router.navigate(['/overzicht']);
    } else if (report.errors.length) {
      this.toast.show(report.errors[0], 5000);
    }
  }

  async showDemo(): Promise<void> {
    this.errorState.set([]);
    this.workspace.loadDemo();
    this.toast.show('Voorbeelddata geladen · wijzigingen worden niet bewaard');
    await this.router.navigate(['/overzicht']);
  }
}
