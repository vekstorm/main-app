import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ESPLoader, Transport } from 'esptool-js';

@Component({
  selector: 'app-flasher',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './flasher-component.html',
  styleUrl: './flasher-component.scss',
})
export class FlasherComponent implements OnInit, OnDestroy {
  @Input({ required: true }) port!: SerialPort;
  @Input() acquirePort: (() => Promise<void>) | undefined;
  @Output() doneWithPort = new EventEmitter<void>();

  protected binFile = signal<File | null>(null);
  protected addressFlash = signal('0x10000');
  protected useDefaultFirmware = signal(false);
  protected compressFirmware = signal(true);
  protected eraseAllFlash = signal(false);
  protected flashing = signal(false);
  protected progress = signal(0);
  protected statusMsg = signal('');
  protected validationError = signal('');
  protected showSuccess = signal(false);

  protected downloadModeStatus = signal<'checking' | 'ready' | 'not-ready'>('checking');

  private transport: Transport | undefined;
  private portAcquired = false;
  private stopReadLoop = false;
  private checkingDnld = false;

  protected get canFlash(): boolean {
    if (this.flashing()) return false;
    if (this.useDefaultFirmware()) return true;
    return this.binFile() !== null;
  }

  ngOnInit(): void {
    setTimeout(() => this.checkDownloadMode(), 300);
  }

  protected checkAgain(): void {
    this.checkDownloadMode();
  }

  protected dismissSuccess(): void {
    this.showSuccess.set(false);
  }

  private async checkDownloadMode(): Promise<void> {
    if (this.checkingDnld || this.flashing()) return;
    this.checkingDnld = true;
    this.downloadModeStatus.set('checking');

    await this.acquirePort?.();

    let transport: Transport | undefined;
    let stopRead = false;

    try {
      transport = new Transport(this.port);
      transport!.connect = async (baud = 115200) => { transport!.baudrate = baud; };
      const t = transport!;

      transport!.readLoop = async () => {
        while (this.port.readable && !stopRead) {
          try {
            const reader = this.port.readable.getReader();
            (t as any).__reader = reader;
            try {
              const { value, done } = await reader.read();
              if (done || stopRead) break;
              if (value?.length) {
                (t as any).buffer = t.appendArray((t as any).buffer, new Uint8Array(value));
              }
            } finally {
              try { reader.releaseLock(); } catch { }
              (t as any).__reader = null;
            }
          } catch { break; }
        }
      };

      const loader = new ESPLoader({
        transport,
        baudrate: 115200,
        enableTracing: false,
      });

      await loader.connect('no_reset', 1, false);
      this.downloadModeStatus.set('ready');
    } catch {
      this.downloadModeStatus.set('not-ready');
    } finally {
      stopRead = true;
      if (transport) {
        try { (transport as any).__reader?.releaseLock(); } catch { }
      }
      this.checkingDnld = false;
      this.doneWithPort.emit();
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.validationError.set('');

    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'bin') {
        this.validationError.set(`Invalid file type (.${ext}). Only .bin files are accepted.`);
        this.binFile.set(null);
        input.value = '';
        return;
      }
    }

    this.binFile.set(file);
  }

  protected async startFlash(): Promise<void> {
    if (!this.canFlash || this.checkingDnld) return;

    this.validationError.set('');

    if (!this.useDefaultFirmware() && !this.binFile()) {
      this.validationError.set('Select a .bin file before flashing.');
      return;
    }

    this.flashing.set(true);
    this.progress.set(0);
    this.statusMsg.set('Starting flash…');

    try {
      let binData: Uint8Array;

      if (this.useDefaultFirmware()) {
        this.statusMsg.set('Loading default firmware…');
        const resp = await fetch('/firmware-iotizzer.bin');
        if (!resp.ok) {
          throw new Error(`Failed to load default firmware (${resp.status})`);
        }
        binData = new Uint8Array(await resp.arrayBuffer());
      } else {
        const file = this.binFile()!;
        binData = new Uint8Array(await file.arrayBuffer());
      }

      const flashAddress = parseInt(this.addressFlash(), 16);
      if (isNaN(flashAddress)) {
        this.validationError.set('Invalid flash address. Use hexadecimal format (e.g. 0x10000).');
        this.flashing.set(false);
        return;
      }

      // Ask the parent to release its reader/writer (port stays open)
      this.statusMsg.set('Acquiring serial port…');
      await this.acquirePort?.();
      this.portAcquired = true;

      // Create Transport wrapping the already-open port.
      // Override connect() to not call port.open() since it's already open.
      const transport = new Transport(this.port);
      transport.tracing = true;
      transport.connect = async (baud = 115200) => { transport.baudrate = baud; };
      // Override readLoop with a cooperative-stop version.
      // It stores the active reader and checks a flag each iteration.
      this.stopReadLoop = false;
      transport.readLoop = async () => {
        while (this.port.readable && !this.stopReadLoop) {
          try {
            const reader = this.port.readable.getReader();
            (transport as any).__reader = reader;
            try {
              const { value, done } = await reader.read();
              if (done || this.stopReadLoop) break;
              if (value?.length) {
                (transport as any).buffer = transport.appendArray((transport as any).buffer, new Uint8Array(value));
              }
            } finally {
              try { reader.releaseLock(); } catch { }
              (transport as any).__reader = null;
            }
          } catch {
            break;
          }
        }
      };
      this.transport = transport;

      // Capture ESPLoader output for diagnostics
      let loaderLog = '';
      const loader = new ESPLoader({
        transport: this.transport,
        baudrate: 115200,
        terminal: {
          write: (msg: string) => { loaderLog += msg; },
          writeLine: (data: string) => { loaderLog += data + '\n'; },
          clean: () => { loaderLog = ''; },
        },
        enableTracing: true,
      });

      try {
        await loader.connect('default_reset', 7, true);
      } catch {
        const log = loaderLog.trim();
        this.statusMsg.set(
          `Chip connection error.\n${log ? `ESPLoader log:\n${log}\n` : ''}` +
          'Make sure the ESP32 is in download mode:\n' +
          '1. Hold GPIO0 to GND\n' +
          '2. Press the RESET/EN button\n' +
          '3. Release GPIO0\n' +
          '4. Try again'
        );
        return;
      }

      this.statusMsg.set('Initializing SPI flash…');
      await loader.flashSpiAttach(0);

      this.statusMsg.set('Loading stub…');
      await loader.runStub();

      this.statusMsg.set('Connected to chip. Flashing…');

      await loader.writeFlash({
        fileArray: [{ data: binData, address: flashAddress }],
        flashSize: '4MB',
        flashMode: 'dio',
        flashFreq: '40m',
        eraseAll: this.eraseAllFlash(),
        compress: this.compressFirmware(),
        reportProgress: (_fileIndex: number, written: number, total: number) => {
          this.progress.set(Math.round((written / total) * 100));
        },
      });

      await loader.after('hard_reset');

      this.progress.set(100);
      this.statusMsg.set('Flash complete!');
      this.showSuccess.set(true);
    } catch (err: any) {
      this.statusMsg.set(`Error: ${err.message ?? 'Flash failed'}`);
    } finally {
      await this.disconnectTransport();
      this.flashing.set(false);
    }
  }

  ngOnDestroy(): void {
    this.disconnectTransport();
  }

  private async disconnectTransport(): Promise<void> {
    if (this.transport) {
      // Signal the cooperative readLoop to stop.
      this.stopReadLoop = true;
      // Release the reader lock to unblock any in-progress read().
      try {
        (this.transport as any).__reader?.releaseLock();
      } catch { }
      this.transport = undefined;
    }
    if (this.portAcquired) {
      this.portAcquired = false;
      this.doneWithPort.emit();
    }
  }
}
