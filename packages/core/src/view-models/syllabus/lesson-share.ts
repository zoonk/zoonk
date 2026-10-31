/** Call with studied and known plan lessons; returns zero without lessons and caps at one. */
export function getLessonShare({ done, total }: { done: number; total: number }): number {
  return total > 0 ? Math.min(1, done / total) : 0;
}
