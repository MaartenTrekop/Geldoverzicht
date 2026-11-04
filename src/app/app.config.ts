import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { persistenceProviders } from '../environments/persistence';
import { routes } from './app.routes';
import { Workspace } from './state/workspace';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash URLs (#/overzicht) work on static hosting such as GitHub Pages without rewrites.
    provideRouter(routes, withHashLocation()),
    // Browser storage by default; the local-db configuration swaps in the local SQLite API.
    ...persistenceProviders,
    // Load stored data before the first route is resolved (its guards need it).
    provideAppInitializer(() => inject(Workspace).load()),
  ],
};
