export type AdminQueryParams = Record<string, string | undefined>;

type QueryEntry = [string, string | undefined];

/**
 * URLSearchParams only accepts complete string pairs. This guard lets callers
 * pass optional filters without leaking empty placeholders into the URL.
 */
function isFilledEntry(entry: QueryEntry): entry is [string, string] {
  return Boolean(entry[1]);
}

/**
 * Admin lists keep their filters in the URL so filtered views are shareable
 * and server-rendered. Empty values are dropped so links stay canonical.
 */
export function buildAdminHref<Path extends string>({
  params,
  path,
}: {
  params: AdminQueryParams;
  path: Path;
}): Path | `${Path}?${string}` {
  const query = new URLSearchParams(
    Object.entries(params).filter((entry) => isFilledEntry(entry)),
  ).toString();

  return query ? `${path}?${query}` : path;
}
