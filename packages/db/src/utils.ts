const MAX_QUERY_ITEMS = 100;

export function clampQueryItems(count: number): number {
  return Math.min(Math.max(count, 1), MAX_QUERY_ITEMS);
}
