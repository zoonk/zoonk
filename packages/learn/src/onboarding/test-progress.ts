export function testProgressPercent(value: number): number {
  return Math.floor(Math.min(1, Math.max(0, value)) * 100);
}
