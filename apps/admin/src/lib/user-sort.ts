const defaultUserSort = "brain-power";
const userSorts = [defaultUserSort, "newest-signups"] as const;

export type UserSort = (typeof userSorts)[number];

export function parseUserSort(value: string | string[] | undefined): UserSort {
  const sort = Array.isArray(value) ? value[0] : value;

  return isUserSort(sort) ? sort : defaultUserSort;
}

export function getUserSortQueryValue(sort: UserSort): string | undefined {
  return sort === defaultUserSort ? undefined : sort;
}

function isUserSort(value: string | undefined): value is UserSort {
  return userSorts.some((sort) => sort === value);
}
