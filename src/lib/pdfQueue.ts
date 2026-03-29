// pdfQueue.ts
// Client-side singleton — manages PDF extraction queue to stay within
// Gemini free tier limits (15 requests/minute → 1 every 4.5 s = ~13/min)

export type QueueItemStatus = 'waiting' | 'processing' | 'done' | 'error' | 'retrying';

export type QueueItem = {
  id: string;
  file: File;
  status: QueueItemStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  retries: number;
  fileName: string;
  fileSize: number;
};

type QueueCallback = (queue: QueueItem[]) => void;

class PDFQueueManager {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private listeners: QueueCallback[] = [];
  private readonly DELAY_MS = 4500;     // 4.5 s between requests → safe under 15/min
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 10000; // 10 s back-off on rate-limit

  subscribe(callback: QueueCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notify() {
    const snapshot = [...this.queue];
    this.listeners.forEach((l) => l(snapshot));
  }

  addFiles(files: File[]): string[] {
    const ids: string[] = [];
    files.forEach((file) => {
      const id = `pdf_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      this.queue.push({
        id,
        file,
        status: 'waiting',
        result: null,
        error: null,
        retries: 0,
        fileName: file.name,
        fileSize: file.size,
      });
      ids.push(id);
    });
    this.notify();
    this.processNext();
    return ids;
  }

  removeItem(id: string) {
    this.queue = this.queue.filter((item) => item.id !== id);
    this.notify();
  }

  clearCompleted() {
    this.queue = this.queue.filter(
      (item) => item.status !== 'done' && item.status !== 'error'
    );
    this.notify();
  }

  retryItem(id: string) {
    const item = this.queue.find((i) => i.id === id);
    if (item && item.status === 'error') {
      item.status = 'waiting';
      item.error = null;
      this.notify();
      this.processNext();
    }
  }

  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  private async processNext() {
    if (this.isProcessing) return;

    const next = this.queue.find((item) => item.status === 'waiting');
    if (!next) return;

    this.isProcessing = true;
    next.status = 'processing';
    this.notify();

    try {
      const formData = new FormData();
      formData.append('pdf', next.file);

      const res = await fetch('/api/extract-policy', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.status === 429 && next.retries < this.MAX_RETRIES) {
        // Rate limited — back off then retry
        next.status = 'retrying';
        next.retries++;
        this.notify();
        await this.sleep(this.RETRY_DELAY_MS);
        next.status = 'waiting';
        this.notify();
      } else if (!res.ok) {
        next.status = 'error';
        next.error = data.error || 'Extraction failed';
      } else {
        next.status = 'done';
        next.result = data.data as Record<string, unknown>;
      }
    } catch {
      next.status = 'error';
      next.error = 'Network error — please check connection';
    }

    this.notify();
    this.isProcessing = false;

    // Pause before processing next to respect rate limit
    await this.sleep(this.DELAY_MS);
    this.processNext();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton — same instance imported everywhere across the app
export const pdfQueue = new PDFQueueManager();
