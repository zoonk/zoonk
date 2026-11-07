/** Adds `params` to an href that may already carry its own, such as a host's `?goal=`. */
export function withSearchParams(href: string, params: Record<string, string | undefined>): string {
  const [path = "", query = ""] = href.split("?");
  const search = new URLSearchParams(query);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      search.set(key, value);
    }
  });

  const merged = search.toString();
  return merged ? `${path}?${merged}` : path;
}
