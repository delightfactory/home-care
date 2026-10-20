export interface PerformanceEntry {
  query_type: string;
  execution_time_ms: number;
  query_hash: string;
  created_at: string;
}

export class PerformanceRecorder {
  private queue: { entry: PerformanceEntry; scope: number }[] = [];
  private sending = false;
  private scheduled = false;
  private written = 0;
  private dropped = 0;
  private failed = 0;

  constructor(
    private readonly send: (entries: PerformanceEntry[]) => Promise<void>,
    private readonly scope: () => number
  ) {}

  record(entry: PerformanceEntry, scope = this.scope()): void {
    if (this.queue.length >= 200) {
      this.dropped++;
      return;
    }
    this.queue.push({ entry, scope });
    this.schedule();
  }

  getStats() {
    return { queued: this.queue.length, sending: this.sending, written: this.written, dropped: this.dropped, failed: this.failed };
  }

  private schedule(): void {
    if (this.sending || this.scheduled || !this.queue.length) return;
    this.scheduled = true;
    setTimeout(() => {
      this.scheduled = false;
      void this.flush();
    }, 0);
  }

  private async flush(): Promise<void> {
    const batch = this.queue.splice(0, 20);
    const entries = batch.filter(queued => queued.scope === this.scope()).map(queued => queued.entry);
    this.dropped += batch.length - entries.length;
    if (!entries.length) { this.schedule(); return; }
    this.sending = true;
    try {
      await this.send(entries);
      this.written += entries.length;
    } catch (failure) {
      this.failed += entries.length;
      console.warn('تعذر حفظ قياسات الأداء', failure);
    } finally {
      this.sending = false;
      this.schedule();
    }
  }
}
