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
    path: 'device-console',
    loadComponent: () => import("./components/device-console/device-console").then((m) => m.DeviceConsole)
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
