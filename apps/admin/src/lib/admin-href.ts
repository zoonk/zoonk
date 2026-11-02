export type AdminQueryParams = Record<string, string | undefined>;

type QueryEntry = [string, string | undefined];

function isFilledEntry(entry: QueryEntry): entry is [string, string] {
  return Boolean(entry[1]);
}

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
