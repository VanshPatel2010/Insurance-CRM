// pdfQueue.ts
// Client-side singleton — manages PDF extraction queue to stay within
// the strictest provider rate limit currently active.
//
// Gemini: 15 req/min → 1 every 4.5 s (≈ 13/min, safe headroom)
// Groq / HuggingFace / Together: more generous limits, so Gemini's
// 4.5 s delay is the floor — no change needed when fallback is active.

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
  /** Which AI provider successfully handled this item (set on done). */
  provider?: string;
  /** True when all providers are exhausted — prompts the user to fill manually. */
  fallbackToManual?: boolean;
};

type QueueCallback = (queue: QueueItem[]) => void;

class PDFQueueManager {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private listeners: QueueCallback[] = [];

  // 4.5 s between requests — safe under Gemini's 15 RPM hard limit.
  // Fallback providers have larger windows so this delay also covers them.
  private readonly DELAY_MS = 4500;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 10000; // 10 s back-off on 429

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
      item.fallbackToManual = false;
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
      } else if (res.status === 503 && data?.fallbackToManual) {
        // All AI providers exhausted — ask user to fill in manually
        next.status = 'error';
        next.fallbackToManual = true;
        next.error =
          data.message ||
          'All AI providers are currently unavailable. Please fill in the policy details manually.';
      } else if (!res.ok) {
        next.status = 'error';
        next.error = data?.error || 'Extraction failed';
      } else {
        next.status = 'done';
        next.result = data.data as Record<string, unknown>;
        next.provider = data.provider as string | undefined;
      }
    } catch {
      next.status = 'error';
      next.error = 'Network error — please check your connection';
    }

    this.notify();
    this.isProcessing = false;

    // Pause before next item to respect the strictest rate limit
    await this.sleep(this.DELAY_MS);
    this.processNext();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton — same instance imported everywhere across the app
export const pdfQueue = new PDFQueueManager();
