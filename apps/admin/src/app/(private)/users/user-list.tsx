import { auth } from "@zoonk/auth";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { safeParams } from "@zoonk/utils/params";
import { cacheLife } from "next/cache";
import { headers } from "next/headers";
import { UserPagination } from "./user-pagination";
import { UserRow } from "./user-row";

const DEFAULT_PAGE_SIZE = 50;

type UserListProps = {
  searchParams: PageProps<"/users">["searchParams"];
};

export default async function UserList({ searchParams }: UserListProps) {
  "use cache: private";
  cacheLife("minutes");

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * limit;
  const search = safeParams(params.search);

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

      <UserPagination
        limit={limit}
        page={page}
        search={search}
        totalPages={totalPages}
      />
    </>
  );
}
