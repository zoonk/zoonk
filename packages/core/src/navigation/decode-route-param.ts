/**
 * Normalizes a route segment before it becomes a cache key or database input.
 * Malformed percent sequences stay unchanged so an invalid URL resolves as not
 * found instead of turning into a server error.
 */
export function decodeRouteParam(param: string) {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}
