import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Workspace } from './state/workspace';

/** The overview needs transactions; without them go to the import page. */
const requireData: CanActivateFn = () =>
  inject(Workspace).hasData() || inject(Router).createUrlTree(['/']);

/** With transactions loaded, the start page forwards to the overview. */
const skipWhenLoaded: CanActivateFn = () =>
  !inject(Workspace).hasData() || inject(Router).createUrlTree(['/overzicht']);

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Geldoverzicht',
    canActivate: [skipWhenLoaded],
    loadComponent: () => import('./features/import/import-page').then((m) => m.ImportPage),
  },
  {
    path: 'overzicht',
    title: 'Overzicht · Geldoverzicht',
    canActivate: [requireData],
    loadComponent: () => import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
  },
  { path: '**', redirectTo: '' },
];
