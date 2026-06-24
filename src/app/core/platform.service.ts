import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PlatformService {

  get isNative(): boolean {
    return !!(window as any).Capacitor?.isNativePlatform();
  }

  get isWeb(): boolean {
    return !(window as any).Capacitor?.isNativePlatform();
  }

  get hasWebBluetooth(): boolean {
    return 'bluetooth' in navigator;
  }

  get hasWebSerial(): boolean {
    return 'serial' in navigator;
  }
}
