import "server-only";
import { auth } from "@zoonk/core/auth";
import { headers } from "next/headers";

export async function listUsers(params: { limit: number; offset: number; search?: string }) {
  const { limit, offset, search } = params;

  const result = await auth.api.listUsers({
    headers: await headers(),
    query: {
      limit,
      offset,
      sortBy: "createdAt",
      sortDirection: "desc",
      ...(search && {
        searchField: "email",
        searchOperator: "contains",
        searchValue: search,
      }),
    },
  });

  return { total: result.total, users: result.users };
}
