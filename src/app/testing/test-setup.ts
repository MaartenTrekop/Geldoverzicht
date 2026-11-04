import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CLOCK } from '../state/clock';

/** Fixed "today" for tests: 4 November 2026, so the demo and month logic are predictable. */
export const TEST_TODAY = new Date(2026, 10, 4);

/** Common providers: an empty router and a fixed clock. Clears browser storage between tests. */
export function configureTestBed(imports: unknown[] = []): void {
  globalThis.localStorage?.clear();
  TestBed.configureTestingModule({
    imports,
    providers: [provideRouter([]), { provide: CLOCK, useValue: () => TEST_TODAY }],
  });
}

/** Text content with all kinds of whitespace (Intl uses no-break spaces) collapsed to one space. */
export function textOf(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}
