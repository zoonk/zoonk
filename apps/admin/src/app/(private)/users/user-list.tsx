import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
  emptyListLabel,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { listUsers } from "@/data/users/list-users";
import { buildAdminHref } from "@/lib/admin-href";
import { parseSearchParams } from "@/lib/parse-search-params";
import { type UserSort, getUserSortQueryValue, parseUserSort } from "@/lib/user-sort";
import { UserRow } from "./user-row";

function userColumns({ search, sort }: { search?: string; sort?: UserSort }): AdminTableColumn[] {
  const sortBy = (column: UserSort) => ({
    href: buildAdminHref({
      params: { search, sort: getUserSortQueryValue(column) },
      path: "/users",
    }),
    isActive: sort === column,
  });

  return [
    { label: "User", twoLines: true },
    { label: "Plan" },
    { align: "right", label: "Brain Power", sort: sortBy("brain-power") },
    { label: "Last active" },
    { label: "Joined", sort: sortBy("newest-signups") },
  ];
}

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

  return (
    <>
      <AdminTableColumns
        columns={userColumns({ search, sort })}
        emptyLabel={emptyListLabel({ noun: "users", search })}
        isEmpty={users.length === 0}
      >
        {users.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/users"
        limit={limit}
        page={page}
        queryParams={{ sort: getUserSortQueryValue(sort) }}
        search={search}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function UserListSkeleton() {
  return <AdminTableColumnsSkeleton columns={userColumns({})} />;
}
