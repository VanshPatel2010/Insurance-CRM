export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function estimateQueueTime(waitingCount: number): string {
  const seconds = waitingCount * 4.5;
  if (seconds < 60) return `~${Math.ceil(seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes} minute${minutes > 1 ? 's' : ''}`;
}
