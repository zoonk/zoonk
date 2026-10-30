import { AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
import { AdminPagination } from "@/components/pagination";
import { listUsers } from "@/data/users/list-users";
import { parseSearchParams } from "@/lib/parse-search-params";
import { type UserSort, getUserSortQueryValue, parseUserSort } from "@/lib/user-sort";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { ArrowDown } from "lucide-react";
import Link from "next/link";
import { UserRow } from "./user-row";

type SortQueryEntry = [string, string | undefined] | undefined;

export async function UserList({
  searchParams,
}: {
  searchParams: PageProps<"/users">["searchParams"];
}) {
  const params = await searchParams;
  const { page, limit, offset, search } = parseSearchParams(params);
  const sort = parseUserSort(params.sort);

  return <CachedUserList limit={limit} offset={offset} page={page} search={search} sort={sort} />;
}

/** Normalized values keep each cache key the same across both runtime-prefetch passes. */
async function CachedUserList({
  limit,
  offset,
  page,
  search,
  sort,
}: {
  limit: number;
  offset: number;
  page: number;
  search?: string;
  sort: UserSort;
}) {
  "use cache: private";

  const { users, total } = await listUsers({ limit, offset, search, sort });
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <Table>
        <UserTableHeader search={search} sort={sort} />

        <TableBody>
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </TableBody>
      </Table>

      <AdminPagination
        basePath="/users"
        limit={limit}
        page={page}
        queryParams={{ sort: getUserSortQueryValue(sort) }}
        search={search}
        totalPages={totalPages}
      />
    </>
  );
}

export function UserListSkeleton() {
  return (
    <Table>
      <UserTableHeader />

      <AdminTableSkeletonRows>
        <UserSkeletonRow />
      </AdminTableSkeletonRows>
    </Table>
  );
}

function UserTableHeader({ search, sort }: { search?: string; sort?: UserSort }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>User</TableHead>
        <TableHead>Username</TableHead>
        <SortableUserTableHead
          align="right"
          className="text-right"
          label="Brain Power"
          search={search}
          selectedSort={sort}
          sort="brain-power"
        />
        <SortableUserTableHead
          label="Joined"
          search={search}
          selectedSort={sort}
          sort="newest-signups"
        />
        <TableHead>Subscription</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function UserSkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto h-4 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16" />
      </TableCell>
    </TableRow>
  );
}

function SortableUserTableHead({
  className,
  align = "left",
  label,
  search,
  selectedSort,
  sort,
}: {
  align?: "left" | "right";
  className?: string;
  label: string;
  search?: string;
  selectedSort?: UserSort;
  sort: UserSort;
}) {
  if (!selectedSort) {
    return <TableHead className={className}>{label}</TableHead>;
  }

  const isSelected = selectedSort === sort;

  const linkClassName =
    align === "right"
      ? "hover:text-foreground inline-flex w-full items-center justify-end gap-1 text-inherit transition-colors"
      : "hover:text-foreground inline-flex w-full items-center justify-start gap-1 text-inherit transition-colors";

  return (
    <TableHead aria-sort={isSelected ? "descending" : undefined} className={className}>
      <Link
        aria-current={isSelected ? "page" : undefined}
        className={linkClassName}
        href={buildSortHref({ search, sort })}
        prefetch
      >
        {label}
        {isSelected ? <ArrowDown className="size-3.5" /> : null}
      </Link>
    </TableHead>
  );
}

function buildSortHref({ search, sort }: { search?: string; sort: UserSort }): `/users${string}` {
  const entries: SortQueryEntry[] = [
    getUserSortQueryValue(sort) ? ["sort", sort] : undefined,
    search ? ["search", search] : undefined,
  ];

  const params = new URLSearchParams(entries.filter((entry) => isSortQueryEntry(entry)));
  const queryString = params.toString();

  return queryString ? `/users?${queryString}` : "/users";
}

function isSortQueryEntry(entry: SortQueryEntry): entry is [string, string] {
  return Array.isArray(entry) && Boolean(entry[1]);
}
