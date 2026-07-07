import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'price-tracker',
    pathMatch: 'full',
  },
  {
    path: 'price-tracker',
    loadComponent: () =>
      import('./price-tracker/price-tracker.page').then(
        (m) => m.PriceTrackerPage,
      ),
  },
];
