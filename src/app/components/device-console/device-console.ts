import { Component, inject, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PlatformService } from '../../core/platform.service';

@Component({
  selector: 'app-device-console',
  imports: [RouterLink, FormsModule],
  templateUrl: './device-console.html',
  styleUrl: './device-console.scss',
})
export class DeviceConsole implements OnDestroy {
  private platform = inject(PlatformService);

  @ViewChild('terminalOutput', { static: false })
  private terminalOutputRef?: ElementRef<HTMLElement>;

  protected isWeb = this.platform.isWeb;
  protected isNative = this.platform.isNative;
  protected hasWebBluetooth = this.platform.hasWebBluetooth;
  protected hasWebSerial = this.platform.hasWebSerial;

  autoScroll = signal(true);
  terminalVisible = signal(false);
  connected = signal(false);
  connecting = signal(false);
  connectionType = signal<'bluetooth' | 'serial' | null>(null);
  deviceName = signal('');
  command = signal('');
  receivedData = signal<string[]>([]);
  statusMessage = signal('');

  /* --- Bluetooth state --- */
  private server: BluetoothRemoteGATTServer | undefined | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  /* --- Serial state --- */
  private port: SerialPort | null = null;
  private serialReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private serialBuffer = '';

  private readonly SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
  private readonly TX_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
  private readonly RX_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

  /* ================================================================
   *  BLUETOOTH
   * ================================================================ */

  async onBluetooth(): Promise<void> {
    if (!this.hasWebBluetooth) {
      this.appendLine('[ERROR] Web Bluetooth no disponible en este navegador.');
      return;
    }

    if (this.connected()) return;

    this.connecting.set(true);

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [this.SERVICE_UUID] }],
        optionalServices: [this.SERVICE_UUID],
      });

      this.deviceName.set(device.name ?? 'Dispositivo desconocido');
      device.addEventListener('gattserverdisconnected', () => this.onBtDisconnected());

      this.server = device.gatt;
      if (!this.server) throw new Error('GATT server no disponible');

      await this.server.connect();

      const service = await this.server.getPrimaryService(this.SERVICE_UUID);
      this.txCharacteristic = await service.getCharacteristic(this.TX_CHAR_UUID);

      try {
        this.rxCharacteristic = await service.getCharacteristic(this.RX_CHAR_UUID);
      } catch {
        this.rxCharacteristic = this.txCharacteristic;
      }

      if (this.rxCharacteristic.properties.notify) {
        await this.rxCharacteristic.startNotifications();
        this.rxCharacteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
          const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
          if (value) {
            this.appendLine(new TextDecoder().decode(value));
          }
        });
      }

      this.connectionType.set('bluetooth');
      this.connected.set(true);
      this.terminalVisible.set(true);
      this.appendLine(`[CONECTADO] ${this.deviceName()}`);
    } catch (err: any) {
      this.statusMessage.set(`Error: ${err.message ?? 'Error al conectar'}`);
      this.appendLine(`[ERROR] ${err.message ?? 'Error al conectar'}`);
    } finally {
      this.connecting.set(false);
    }
  }

  /* ================================================================
   *  SERIAL PORT
   * ================================================================ */

  async onSerial(): Promise<void> {
    if (!this.hasWebSerial) {
      this.statusMessage.set('Web Serial no disponible en este navegador.');
      this.appendLine('[ERROR] Web Serial no disponible en este navegador.');
      return;
    }

    if (this.connected()) return;

    this.statusMessage.set('');
    this.connecting.set(true);

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      const info = port.getInfo();
      const label = info.usbProductId
        ? `Serie (${info.usbVendorId?.toString(16)}:${info.usbProductId.toString(16)})`
        : 'Puerto serie';
      this.deviceName.set(label);

      this.port = port;
      this.serialReader = port.readable!.getReader();
      this.serialWriter = port.writable!.getWriter();
      this.readSerialLoop();

      this.connectionType.set('serial');
      this.connected.set(true);
      this.terminalVisible.set(true);
      this.appendLine(`[CONECTADO] ${this.deviceName()}`);
    } catch (err: any) {
      this.statusMessage.set(`Error: ${err.message ?? 'Error al conectar puerto serie'}`);
      this.appendLine(`[ERROR] ${err.message ?? 'Error al conectar puerto serie'}`);
    } finally {
      this.connecting.set(false);
    }
  }

  private async readSerialLoop(): Promise<void> {
    try {
      const decoder = new TextDecoder();
      while (this.serialReader) {
        const { value, done } = await this.serialReader.read();
        if (done) break;
        if (value) {
          this.serialBuffer += decoder.decode(value, { stream: true });
          const lines = this.serialBuffer.split('\n');
          this.serialBuffer = lines.pop() ?? '';
          for (const line of lines) {
            this.appendLine(line.replace(/\r$/, ''));
          }
        }
      }
    } catch {
      /* reader stream closed */
    }
  }

  /* ================================================================
   *  SEND / DISCONNECT
   * ================================================================ */

  async sendCommand(): Promise<void> {
    const cmd = this.command().trim();
    if (!cmd) return;

    try {
      switch (this.connectionType()) {
        case 'bluetooth':
          if (!this.txCharacteristic) return;
          await this.txCharacteristic.writeValue(new TextEncoder().encode(cmd + '\n'));
          break;
        case 'serial':
          if (!this.serialWriter) return;
          await this.serialWriter.write(new TextEncoder().encode(cmd + '\n'));
          break;
      }
      this.appendLine(`> ${cmd}`);
      this.command.set('');
    } catch (err: any) {
      this.appendLine(`[ERROR] ${err.message ?? 'Error al enviar'}`);
    }
  }

  async disconnect(): Promise<void> {
    switch (this.connectionType()) {
      case 'bluetooth':
        await this.disconnectBluetooth();
        break;
      case 'serial':
        await this.disconnectSerial();
        break;
    }
    this.statusMessage.set('');
    this.appendLine('[DESCONECTADO]');
  }

  /* ---------- internal disconnect helpers ---------- */

  private async disconnectBluetooth(): Promise<void> {
    try {
      if (this.rxCharacteristic?.properties.notify) {
        await this.rxCharacteristic.stopNotifications();
      }
    } catch { /* ignore */ }
    try {
      this.server?.disconnect();
    } catch { /* ignore */ }
    this.cleanupConnection();
  }

  private async disconnectSerial(): Promise<void> {
    try { await this.serialReader?.cancel(); } catch { }
    try { await this.serialWriter?.close(); } catch { }
    try {
      await new Promise(r => setTimeout(r, 50));
      if (this.port) {
        await this.port.close();
      }
    } catch { }
    this.cleanupConnection();
  }

  private onBtDisconnected(): void {
    this.cleanupConnection();
    this.statusMessage.set('El dispositivo Bluetooth se ha desconectado.');
    this.appendLine('[DESCONECTADO] El dispositivo se ha desconectado.');
  }

  private cleanupConnection(): void {
    this.connected.set(false);
    this.connecting.set(false);
    this.terminalVisible.set(false);
    this.connectionType.set(null);
    this.serialBuffer = '';
    this.server = null;
    this.txCharacteristic = null;
    this.rxCharacteristic = null;
    this.port = null;
    this.serialReader = null;
    this.serialWriter = null;
  }

  /* ================================================================
   *  LIFECYCLE
   * ================================================================ */

  ngOnDestroy(): void {
    if (this.connected()) {
      this.disconnect();
    }
  }

  /* ---------- helpers ---------- */

  toggleAutoScroll(): void {
    this.autoScroll.update(v => !v);
  }

  toggleTerminal(): void {
    this.terminalVisible.update(v => !v);
  }

  private appendLine(line: string): void {
    this.receivedData.update(v => [...v, line]);
    if (this.autoScroll()) {
      this.scheduleScroll();
    }
  }

  private scheduleScroll(): void {
    setTimeout(() => {
      this.terminalOutputRef?.nativeElement.scrollTo({
        top: this.terminalOutputRef.nativeElement.scrollHeight,
        behavior: 'smooth',
      });
    });
  }
}
