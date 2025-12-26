import { auth } from "@zoonk/core/auth";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { headers } from "next/headers";
import { AdminPagination } from "@/components/pagination";
import { parseSearchParams } from "@/lib/parse-search-params";
import { UserRow } from "./user-row";

export default async function UserList({
  searchParams,
}: {
  searchParams: PageProps<"/users">["searchParams"];
}) {
  const { page, limit, offset, search } = parseSearchParams(await searchParams);

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

  const totalPages = Math.ceil(result.total / limit);

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email Verified</TableHead>
              <TableHead>Banned</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {result.users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath="/users"
        limit={limit}
        page={page}
        search={search}
        totalPages={totalPages}
      />
    </>
  );
}
