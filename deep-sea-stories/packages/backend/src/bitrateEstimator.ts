export class BitrateEstimator {
  private readonly windowSeconds: number;
  private totalBytesReceived = 0;
  private lastLogTime: number;
  private intervalId: NodeJS.Timeout;
  private logName: string;

  constructor(logName: string, windowSeconds: number = 3) {
    if (windowSeconds <= 0) {
      throw new Error("Bitrate window must be greater than 0");
    }
    this.logName = logName;
    this.windowSeconds = windowSeconds;
    this.lastLogTime = Date.now();

    this.intervalId = setInterval(() => {
      this.processWindow();
    }, this.windowSeconds * 1000);
  }

  public handleBuffer(buffer: Buffer): void {
    this.totalBytesReceived += buffer.length;
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private processWindow(): void {
    const currentTime = Date.now();
    const timeDiffMs = currentTime - this.lastLogTime;
    const timeDiffSeconds = timeDiffMs / 1000;

    this.logBitrate(timeDiffSeconds);

    this.totalBytesReceived = 0;
    this.lastLogTime = currentTime;
  }

  private logBitrate(elapsedSeconds: number): void {
    const totalBits = this.totalBytesReceived * 8;
    const bitsPerSecond = elapsedSeconds > 0 ? totalBits / elapsedSeconds : 0;

    const formattedBitrate = this.formatBitrate(bitsPerSecond);

    console.log(
      `[BitrateCalculator] ${this.logName} | ` +
      `Window: ${elapsedSeconds.toFixed(3)}s | ` +
      `Data: ${this.totalBytesReceived} bytes | ` +
      `Bitrate: ${formattedBitrate}`
    );
  }

  private formatBitrate(bps: number): string {
    if (bps >= 1_000_000) {
      return `${(bps / 1_000_000).toFixed(2)} Mbps`;
    } else if (bps >= 1_000) {
      return `${(bps / 1_000).toFixed(2)} Kbps`;
    }
    return `${Math.round(bps)} bps`;
  }
}
