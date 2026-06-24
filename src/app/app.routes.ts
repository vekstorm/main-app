import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import("./components/home/home").then((m) => m.Home)
  },
  {
    path: 'devices',
    loadComponent: () => import("./components/devices/devices").then((m) => m.Devices)
  },
  {
    path: 'subscription',
    loadComponent: () => import("./components/subscription/subscription").then((m) => m.SubscriptionComponent)
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];
