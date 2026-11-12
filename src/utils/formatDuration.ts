/**
 * Formats duration in milliseconds into a concise readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}
