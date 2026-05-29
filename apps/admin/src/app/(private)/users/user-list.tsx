import { AdminPagination } from "@/components/pagination";
import { listUsers } from "@/data/users/list-users";
import { parseSearchParams } from "@/lib/parse-search-params";
import { type UserSort, getUserSortQueryValue, parseUserSort } from "@/lib/user-sort";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@zoonk/ui/components/table";
import { ArrowDown } from "lucide-react";
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
  const { users, total } = await listUsers({ limit, offset, search, sort });
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="rounded-lg border">
        <Table>
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
        queryParams={{ sort: getUserSortQueryValue(sort) }}
        search={search}
        totalPages={totalPages}
      />
    </>
  );
}

/**
 * Sorting from the column header matches the way admins scan the table: the
 * column label is both the data label and the control for that ordering.
 */
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
  selectedSort: UserSort;
  sort: UserSort;
}) {
  const isSelected = selectedSort === sort;

  const linkClassName =
    align === "right"
      ? "hover:text-foreground inline-flex w-full items-center justify-end gap-1 text-inherit transition-colors"
      : "hover:text-foreground inline-flex w-full items-center justify-start gap-1 text-inherit transition-colors";

  return (
    <TableHead aria-sort={isSelected ? "descending" : undefined} className={className}>
      <a
        aria-current={isSelected ? "page" : undefined}
        className={linkClassName}
        href={buildSortHref({ search, sort })}
      >
        {label}
        {isSelected ? <ArrowDown className="size-3.5" /> : null}
      </a>
    </TableHead>
  );
}

/**
 * Sorting changes should preserve search but reset pagination so a valid page
 * number from one ordering does not land on an unexpectedly sparse result set.
 */
function buildSortHref({ search, sort }: { search?: string; sort: UserSort }): string {
  const entries: SortQueryEntry[] = [
    getUserSortQueryValue(sort) ? ["sort", sort] : undefined,
    search ? ["search", search] : undefined,
  ];

  const params = new URLSearchParams(entries.filter((entry) => isSortQueryEntry(entry)));
  const queryString = params.toString();

  return queryString ? `/users?${queryString}` : "/users";
}

/**
 * URLSearchParams only accepts complete string pairs. This guard keeps optional
 * sort/search entries declarative without weakening the query-building type.
 */
function isSortQueryEntry(entry: SortQueryEntry): entry is [string, string] {
  return Array.isArray(entry) && Boolean(entry[1]);
}
