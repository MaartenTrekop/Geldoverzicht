import { provideHttpClient, withFetch } from '@angular/common/http';
import { EnvironmentProviders, Provider } from '@angular/core';
import { PERSISTENCE } from '../app/state/persistence/persistence';
import { LocalDbPersistence } from '../app/state/persistence/local-db-persistence';

/**
 * Used by `npm run start:local` (`ng serve --configuration local-db`): transactions and
 * settings are kept in the local SQLite database served by `server/`.
 */
export const persistenceProviders: (Provider | EnvironmentProviders)[] = [
  provideHttpClient(withFetch()),
  { provide: PERSISTENCE, useExisting: LocalDbPersistence },
];
