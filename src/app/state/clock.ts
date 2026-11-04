import { InjectionToken } from '@angular/core';

/** Current time, injectable so tests and the demo can use a fixed date. */
export const CLOCK = new InjectionToken<() => Date>('CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
