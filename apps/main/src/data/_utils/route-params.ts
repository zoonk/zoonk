/**
 * Next route params can still be percent-encoded during server rendering when a
 * path segment contains non-ASCII text. Curriculum slugs are stored decoded in
 * the database, so public route lookups need this normalization before querying.
 * If a user sends a malformed percent sequence, keep the original value so the
 * lookup returns not found instead of turning a bad URL into a server error.
 */
export function decodeRouteParam(param: string) {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}
