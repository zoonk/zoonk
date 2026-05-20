export function validateOffset(value?: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export function sumOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
