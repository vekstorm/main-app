import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-devices',
  imports: [RouterLink],
  templateUrl: './devices.html',
  styleUrl: './devices.scss',
})
export class Devices {

  onFlash(): void {
    // TODO: implement flash device flow
  }

  onRegister(): void {
    // TODO: implement register device flow
  }
}
