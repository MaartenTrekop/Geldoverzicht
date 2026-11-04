import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CategoryCatalog, INTERNAL_TRANSFER, SAVINGS } from '../../core/models/category';

const NEW_CATEGORY = '__new__';

/** Category picker grouped like the overview, optionally with "+ Nieuwe categorie…". */
@Component({
  selector: 'app-category-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <select #select [attr.aria-label]="label()" (change)="pick(select)">
      @for (group of groups(); track group.label) {
        @if (group.options.length) {
          <optgroup [label]="group.label">
            @for (option of group.options; track option) {
              <option [value]="option" [selected]="option === value()">{{ option }}</option>
            }
          </optgroup>
        }
      }
      @if (allowCreate()) {
        <option [value]="newCategory">+ Nieuwe categorie…</option>
      }
    </select>
  `,
  styles: `
    select {
      width: 100%;
      max-width: 200px;
    }
  `,
})
export class CategorySelect {
  readonly value = input.required<string>();
  readonly catalog = input.required<CategoryCatalog>();
  readonly allowCreate = input(false);
  readonly label = input('Categorie');
  readonly changed = output<string>();
  readonly createRequested = output<void>();

  protected readonly newCategory = NEW_CATEGORY;

  protected readonly groups = computed(() => {
    const catalog = this.catalog();
    const custom = catalog.custom.map((c) => c.name);
    const customSet = new Set(custom);
    return [
      { label: 'Eigen categorieën', options: custom },
      { label: 'Uitgaven', options: catalog.expenses.filter((c) => !customSet.has(c)) },
      { label: 'Inkomsten', options: catalog.income.filter((c) => !customSet.has(c)) },
      { label: 'Overig', options: [SAVINGS, INTERNAL_TRANSFER] },
    ];
  });

  protected pick(select: HTMLSelectElement): void {
    if (select.value === NEW_CATEGORY) {
      select.value = this.value();
      this.createRequested.emit();
    } else if (select.value !== this.value()) {
      this.changed.emit(select.value);
    }
  }
}
