import { Injectable, effect, inject, signal } from '@angular/core';
import { DEFAULT_SETTINGS, Settings, normalizeSettings } from '../core/models/settings';
import { PERSISTENCE } from './persistence/persistence';

/**
 * The user's configuration (names, categories, overrides, budget plan, savings pots).
 * Saved through the configured persistence after every change, except while the demo is
 * shown and except when loading failed (saving then could overwrite what is stored).
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly persistence = inject(PERSISTENCE);
  private readonly state = signal<Settings>(DEFAULT_SETTINGS);
  private readonly demo = signal(false);
  /** Only after a successful load are changes written back. */
  private readonly loaded = signal(false);
  private readonly saveFailedState = signal(false);
  /** Saves run one after the other, so an older save never overwrites a newer one. */
  private queue: Promise<void> = Promise.resolve();

  readonly settings = this.state.asReadonly();
  readonly saveFailed = this.saveFailedState.asReadonly();

  constructor() {
    effect(() => {
      const settings = this.state();
      if (!this.loaded() || this.demo()) return;
      this.queue = this.queue
        .then(() => this.persistence.saveSettings(settings))
        .then(
          () => this.saveFailedState.set(false),
          () => this.saveFailedState.set(true),
        );
    });
  }

  /** Reads the stored settings. Throws when the storage cannot be reached. */
  async load(): Promise<void> {
    this.loaded.set(false);
    const stored = await this.persistence.loadSettings();
    this.state.set(normalizeSettings(stored));
    this.loaded.set(true);
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

  /** Leaves the demo: the stored settings are loaded before saving is switched back on. */
  async useStored(): Promise<void> {
    try {
      await this.load();
    } finally {
      this.demo.set(false);
    }
  }
}
