import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-device-console',
  imports: [RouterLink],
  templateUrl: './device-console.html',
  styleUrl: './device-console.scss',
})
export class DeviceConsole {

  onBluetooth(): void {
  }

  onSerial(): void {
  }
}
