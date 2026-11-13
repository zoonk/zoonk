import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
  emptyListLabel,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { listSources } from "@/data/sources/list-sources";
import { parseSearchParams } from "@/lib/parse-search-params";
import { type LibraryVisibility, type SourceKind } from "@zoonk/db";
import { parseSourceListFilters } from "./_utils/source-list-params";
import { SourceRow } from "./source-row";

const SOURCE_COLUMNS: AdminTableColumn[] = [
  { label: "Source", twoLines: true },
  { label: "Kind" },
  { label: "Last checked" },
  { label: "Good until" },
  { label: "Used by", size: "wide" },
];

/** Resolves the URL into primitive filters so each list state is its own cache entry. */
export async function SourceList({ searchParams }: Pick<PageProps<"/sources">, "searchParams">) {
  const params = await searchParams;
  const { limit, offset, page } = parseSearchParams(params);
  const filters = parseSourceListFilters(params);

  return (
    <CachedSourceList
      kind={filters.kind}
      limit={limit}
      offset={offset}
      page={page}
      search={filters.search}
      visibility={filters.visibility}
    />
  );
}

async function CachedSourceList({
  kind,
  limit,
  offset,
  page,
  search,
  visibility,
}: {
  kind?: SourceKind;
  limit: number;
  offset: number;
  page: number;
  search?: string;
  visibility?: LibraryVisibility;
}) {
  "use cache: private";

  const { sources, total } = await listSources({ kind, limit, offset, search, visibility });

  return (
    <>
      <AdminTableColumns
        columns={SOURCE_COLUMNS}
        emptyLabel={emptyListLabel({ noun: "sources", search })}
        isEmpty={sources.length === 0}
      >
        {sources.map((source) => (
          <SourceRow key={source.id} source={source} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/sources"
        limit={limit}
        page={page}
        queryParams={{ kind, visibility }}
        search={search}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function SourceListSkeleton() {
  return <AdminTableColumnsSkeleton columns={SOURCE_COLUMNS} />;
}
