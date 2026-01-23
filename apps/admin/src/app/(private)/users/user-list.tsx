import { AdminPagination } from "@/components/pagination";
import { listUsers } from "@/data/users/list-users";
import { parseSearchParams } from "@/lib/parse-search-params";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@zoonk/ui/components/table";
import { UserRow } from "./user-row";

export default async function UserList({
  searchParams,
}: {
  searchParams: PageProps<"/users">["searchParams"];
}) {
  const { page, limit, offset, search } = parseSearchParams(await searchParams);
  const { users, total } = await listUsers({ limit, offset, search });
  const totalPages = Math.ceil(total / limit);

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
            {users.map((user) => (
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
