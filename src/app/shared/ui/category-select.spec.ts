import { TestBed } from '@angular/core/testing';
import { createCategoryCatalog } from '../../core/models/category';
import { configureTestBed } from '../../testing/test-setup';
import { CategorySelect } from './category-select';

describe('CategorySelect', () => {
  beforeEach(() => configureTestBed([CategorySelect]));

  async function render(allowCreate: boolean) {
    const fixture = TestBed.createComponent(CategorySelect);
    fixture.componentRef.setInput('value', 'Winkelen');
    fixture.componentRef.setInput(
      'catalog',
      createCategoryCatalog([{ name: 'Paard', kind: 'expense', owner: 'person2' }]),
    );
    fixture.componentRef.setInput('allowCreate', allowCreate);
    await fixture.whenStable();
    const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;
    return { fixture, select };
  }

  it('groups custom categories first and selects the current value', async () => {
    const { select } = await render(false);
    const groups = [...select.querySelectorAll('optgroup')].map((g) => g.label);
    expect(groups).toEqual(['Eigen categorieën', 'Uitgaven', 'Inkomsten', 'Overig']);
    expect(select.value).toBe('Winkelen');
  });

  it('emits the chosen category', async () => {
    const { fixture, select } = await render(false);
    const changed: string[] = [];
    fixture.componentInstance.changed.subscribe((c) => changed.push(c));

    select.value = 'Paard';
    select.dispatchEvent(new Event('change'));

    expect(changed).toEqual(['Paard']);
  });

  it('asks for a new category without changing the selection', async () => {
    const { fixture, select } = await render(true);
    let requested = 0;
    fixture.componentInstance.createRequested.subscribe(() => requested++);

    select.value = '__new__';
    select.dispatchEvent(new Event('change'));

    expect(requested).toBe(1);
    expect(select.value).toBe('Winkelen');
  });
});
