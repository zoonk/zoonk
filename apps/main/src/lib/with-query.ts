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
