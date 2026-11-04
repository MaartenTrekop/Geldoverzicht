import { Injectable, effect, inject, signal } from '@angular/core';
import { Settings, normalizeSettings } from '../core/models/settings';
import { BrowserStorage } from './browser-storage';

const STORAGE_KEY = 'geldoverzicht.settings.v1';

/**
 * The user's configuration (names, categories, overrides, budget plan, savings pots).
 * Persisted in the browser, except while the demo is shown.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(BrowserStorage);
  private readonly state = signal<Settings>(this.loadStored());
  private readonly demo = signal(false);

  readonly settings = this.state.asReadonly();

  constructor() {
    effect(() => {
      const settings = this.state();
      if (!this.demo()) this.storage.write(STORAGE_KEY, settings);
    });
  }

  /** Applies one of the pure updates from `core/settings/settings-updates`. */
  update(change: (settings: Settings) => Settings): void {
    this.state.update(change);
  }

  /** Shows demo settings without touching what is stored. */
  useDemo(settings: Settings): void {
    this.demo.set(true);
    this.state.set(settings);
  }

  /** Goes back to the stored settings. */
  useStored(): void {
    this.demo.set(false);
    this.state.set(this.loadStored());
  }

  private loadStored(): Settings {
    return normalizeSettings(this.storage.read(STORAGE_KEY));
  }
}
