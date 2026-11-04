import { EnvironmentProviders, Provider } from '@angular/core';

/**
 * Persistence providers for the default builds: none, so the stores use the browser
 * (see `PERSISTENCE`). The `local-db` configuration replaces this file with
 * `persistence.local-db.ts`.
 */
export const persistenceProviders: (Provider | EnvironmentProviders)[] = [];
