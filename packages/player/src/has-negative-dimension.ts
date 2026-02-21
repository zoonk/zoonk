export function hasNegativeDimension(dimensions: Record<string, number>): boolean {
  return Object.values(dimensions).some((value) => value < 0);
}
