const defaultUserSort = "brain-power";
const userSorts = [defaultUserSort, "newest-signups"] as const;

export type UserSort = (typeof userSorts)[number];

/**
 * User sorting is URL-driven so admins can share a filtered table state. Unknown
 * query values should fall back to Brain Power instead of changing the table
 * order through arbitrary user-controlled strings.
 */
export function parseUserSort(value: string | string[] | undefined): UserSort {
  const sort = Array.isArray(value) ? value[0] : value;

  return isUserSort(sort) ? sort : defaultUserSort;
}

/**
 * Brain Power is the default user ranking, so omitting it from generated URLs
 * keeps the normal admin users page clean while preserving non-default sorts.
 */
export function getUserSortQueryValue(sort: UserSort): string | undefined {
  return sort === defaultUserSort ? undefined : sort;
}

/**
 * The parser needs a runtime guard because query params arrive as untrusted
 * strings even though the rest of the app works with a narrow sort union.
 */
function isUserSort(value: string | undefined): value is UserSort {
  return userSorts.some((sort) => sort === value);
}
