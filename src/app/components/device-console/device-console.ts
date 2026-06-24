import { Component, inject, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PlatformService } from '../../core/platform.service';
import { FlasherComponent } from './components/flasher-component/flasher-component';
import { AddDeviceComponent } from './components/add-device-component/add-device-component';

@Component({
  selector: 'app-device-console',
  imports: [RouterLink, FormsModule, FlasherComponent, AddDeviceComponent],
  templateUrl: './device-console.html',
  styleUrl: './device-console.scss',
})
export class DeviceConsole implements OnDestroy {
  private platform = inject(PlatformService);

  acquirePort = () => this.releaseSerialStreams();

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
  activePanel = signal<'flasher' | 'add-device' | null>(null);

  /* --- Bluetooth state --- */
  private server: BluetoothRemoteGATTServer | undefined | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  /* --- Serial state --- */
  protected port: SerialPort | null = null;
  private serialReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private serialBuffer = '';
  private reopening = false;

  private readonly SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
  private readonly TX_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
  private readonly RX_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

  /* ================================================================
   *  BLUETOOTH
   * ================================================================ */

  async onBluetooth(): Promise<void> {
    if (!this.hasWebBluetooth) {
      this.appendLine('[ERROR] Web Bluetooth not available in this browser.');
      return;
    }

    if (this.connected()) return;

    this.connecting.set(true);

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [this.SERVICE_UUID] }],
        optionalServices: [this.SERVICE_UUID],
      });

      this.deviceName.set(device.name ?? 'Unknown device');
      device.addEventListener('gattserverdisconnected', () => this.onBtDisconnected());

      this.server = device.gatt;
      if (!this.server) throw new Error('GATT server not available');

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
      this.appendLine(`[CONNECTED] ${this.deviceName()}`);
    } catch (err: any) {
      this.statusMessage.set(`Error: ${err.message ?? 'Connection failed'}`);
      this.appendLine(`[ERROR] ${err.message ?? 'Connection failed'}`);
    } finally {
      this.connecting.set(false);
    }
  }

  /* ================================================================
   *  SERIAL PORT
   * ================================================================ */

  async onSerial(): Promise<void> {
    if (!this.hasWebSerial) {
      this.statusMessage.set('Web Serial not available in this browser.');
      this.appendLine('[ERROR] Web Serial not available in this browser.');
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
        ? `Serial (${info.usbVendorId?.toString(16)}:${info.usbProductId.toString(16)})`
        : 'Serial port';
      this.deviceName.set(label);

      this.port = port;
      this.serialReader = port.readable!.getReader();
      this.serialWriter = port.writable!.getWriter();
      this.readSerialLoop();

      this.connectionType.set('serial');
      this.connected.set(true);
      this.terminalVisible.set(true);
      this.appendLine(`[CONNECTED] ${this.deviceName()}`);
    } catch (err: any) {
      this.statusMessage.set(`Error: ${err.message ?? 'Failed to connect to serial port'}`);
      this.appendLine(`[ERROR] ${err.message ?? 'Failed to connect to serial port'}`);
    } finally {
      this.connecting.set(false);
    }
  }

  private async readSerialLoop(): Promise<void> {
    try {
      const decoder = new TextDecoder();
      while (this.serialReader) {
        const result = await this.serialReader.read();
        if (result.done) break;
        const value = result.value;
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
      /* stream released */
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
      this.appendLine(`[ERROR] ${err.message ?? 'Send failed'}`);
    }
  }

  async disconnect(): Promise<void> {
    this.activePanel.set(null);
    switch (this.connectionType()) {
      case 'bluetooth':
        await this.disconnectBluetooth();
        break;
      case 'serial':
        await this.disconnectSerial();
        break;
    }
    this.statusMessage.set('');
    this.appendLine('[DISCONNECTED]');
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

  private async disconnectSerial(keepPortRef = false): Promise<void> {
    await this.releaseSerialStreams(true);
    this.cleanupConnection();
    if (!keepPortRef) {
      this.port = null;
    }
  }

  /**
   * Release locks on the serial reader/writer.
   * If closePort is true (full disconnect), also close the port.
   * If false (flasher acquiring port), keep the port open.
   */
  private async releaseSerialStreams(closePort = false): Promise<void> {
    const reader = this.serialReader;
    const writer = this.serialWriter;
    this.serialReader = null;
    this.serialWriter = null;
    this.serialBuffer = '';
    try { reader?.releaseLock(); } catch { }
    if (writer) {
      try { writer.releaseLock(); } catch { }
    }
    if (closePort && this.port) {
      try {
        await this.port.close();
      } catch { }
    }
  }

  /**
   * Reopen the serial port and restore terminal streams after the flasher
   * has released it. Called via setTimeout to ensure it runs after the
   * flasher component's ngOnDestroy.
   */
  private async restoreSerialForTerminal(): Promise<void> {
    if (!this.port || this.reopening) return;
    this.reopening = true;
    try {
      this.serialReader = this.port.readable!.getReader();
      this.serialWriter = this.port.writable!.getWriter();
      this.readSerialLoop();
      this.appendLine('[INFO] Serial terminal restored.');
    } catch (err: any) {
      this.port = null;
      this.cleanupConnection();
      this.statusMessage.set('Failed to restore terminal. Reconnect the serial port.');
    } finally {
      this.reopening = false;
    }
  }

  private onBtDisconnected(): void {
    this.cleanupConnection();
    this.statusMessage.set('The Bluetooth device disconnected.');
    this.appendLine('[DISCONNECTED] The Bluetooth device disconnected.');
  }

  private cleanupConnection(): void {
    this.connected.set(false);
    this.connecting.set(false);
    this.terminalVisible.set(false);
    this.connectionType.set(null);
    this.server = null;
    this.txCharacteristic = null;
    this.rxCharacteristic = null;
  }

  /* ================================================================
   *  LIFECYCLE
   * ================================================================ */

  ngOnDestroy(): void {
    if (this.connected()) {
      this.disconnect();
    }
    this.port = null;
  }

  /* ---------- helpers ---------- */

  toggleAutoScroll(): void {
    this.autoScroll.update(v => !v);
  }

  toggleTerminal(): void {
    this.terminalVisible.update(v => !v);
  }

  showPanel(panel: 'flasher' | 'add-device'): void {
    if (this.activePanel() === panel) {
      this.closeActivePanel();
      return;
    }
    if (this.activePanel() === 'flasher') {
      this.closeActivePanel();
    }
    this.activePanel.set(panel);
  }

  onDoneWithPort(): void {
    setTimeout(() => this.restoreSerialForTerminal(), 50);
  }

  private closeActivePanel(): void {
    this.activePanel.set(null);
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
