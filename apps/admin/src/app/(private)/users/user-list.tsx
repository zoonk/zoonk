import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { cacheLife } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { UserPagination } from "./user-pagination";

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

  const result = await auth.api.listUsers({
    headers: await headers(),
    query: {
      limit,
      offset,
      sortBy: "createdAt",
      sortDirection: "desc",
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
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.name || "—"}
                </TableCell>

                <TableCell>{user.email}</TableCell>

                <TableCell className="capitalize">
                  {user.role || "user"}
                </TableCell>

                <TableCell>
                  {user.emailVerified ? (
                    <span className="text-success">✓</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell>
                  {user.banned ? (
                    <span className="text-destructive">Yes</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <UserPagination limit={limit} page={page} totalPages={totalPages} />
    </>
  );
}
