export function getUserSearchWhere({ search }: { search?: string }) {
  if (!search) {
    return;
  }

  return {
    OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { email: { contains: search, mode: "insensitive" as const } },
      { username: { contains: search, mode: "insensitive" as const } },
    ],
  };
}
