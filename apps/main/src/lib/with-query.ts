/**
 * A page's path with the query it was opened with, so logging in from its gate comes back to the
 * same state (a call inside a mock, the goal a practice is for).
 */
export function withQuery(path: string, query: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    for (const item of [value].flat()) {
      if (item !== undefined) {
        search.append(key, item);
      }
    }
  }

  const text = search.toString();
  return text ? `${path}?${text}` : path;
}
