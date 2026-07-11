export const DEFAULT_SEARCH_LIMIT = 10;
export const SEARCH_QUERY_THROTTLE_MS = 300;

export function mergeSearchResults<T extends { id: number | string }>(
  exactMatch: T | null,
  containsMatches: T[],
): T[] {
  if (!exactMatch) {
    return containsMatches;
  }

  const filtered = containsMatches.filter((item) => item.id !== exactMatch.id);
  return [exactMatch, ...filtered];
}
