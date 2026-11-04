import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { Workspace } from './state/workspace';
import { configureTestBed, textOf } from './testing/test-setup';

describe('App', () => {
  beforeEach(() => configureTestBed([App]));

  it('shows the brand and no file actions before anything is imported', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(textOf(element.querySelector('.brand'))).toContain('Geldoverzicht');
    expect(element.querySelector('app-file-picker-button')).toBeNull();
  });

  it('offers to close the demo while it is shown', async () => {
    TestBed.inject(Workspace).loadDemo();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(textOf(element.querySelector('.demo'))).toBe('Voorbeelddata');
    expect(textOf(element)).toContain('Voorbeeld sluiten');
  });
});
