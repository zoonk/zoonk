import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Users",
};

const DEFAULT_PAGE_SIZE = 50;

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
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
    <Container>
      <ContainerHeader>
        <ContainerTitle>Users</ContainerTitle>
        <ContainerDescription>
          Manage all users in the system. Total users: {result.total}
        </ContainerDescription>
      </ContainerHeader>

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
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {user.banned ? (
                    <span className="text-red-600">Yes</span>
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

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                href={`/users?page=${page - 1}&limit=${limit}`}
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                href={`/users?page=${page + 1}&limit=${limit}`}
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </Container>
  );
}
