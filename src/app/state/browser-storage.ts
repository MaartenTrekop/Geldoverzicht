import { Injectable } from '@angular/core';

/**
 * JSON wrapper around `localStorage` that never throws: storage can be unavailable
 * (private browsing, blocked cookies) or full, and the app must keep working without it.
 */
@Injectable({ providedIn: 'root' })
export class BrowserStorage {
  read(key: string): unknown {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Returns `false` when the value could not be stored. */
  write(key: string, value: unknown): boolean {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Nothing to clean up when storage is unavailable.
    }
  }
}
