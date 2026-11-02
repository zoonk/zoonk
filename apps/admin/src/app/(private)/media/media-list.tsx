import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { listMedia } from "@/data/media/list-media";
import { parseSearchParams } from "@/lib/parse-search-params";
import { type LibraryVisibility, type MediaKind } from "@zoonk/db";
import { parseMediaListFilters } from "./_utils/media-list-params";
import { MediaRow } from "./media-row";

const MEDIA_COLUMNS: AdminTableColumn[] = [
  { label: "Preview" },
  { label: "Reuse key" },
  { label: "Kind" },
  { label: "Language" },
  { label: "Style" },
  { label: "Palette" },
  { label: "Size" },
  { label: "Used by" },
  { label: "Provenance" },
  { label: "Created" },
];

export async function MediaList({ searchParams }: Pick<PageProps<"/media">, "searchParams">) {
  const params = await searchParams;
  const { limit, offset, page } = parseSearchParams(params);
  const filters = parseMediaListFilters(params);

  return (
    <CachedMediaList
      kind={filters.kind}
      limit={limit}
      offset={offset}
      page={page}
      visibility={filters.visibility}
    />
  );
}

async function CachedMediaList({
  kind,
  limit,
  offset,
  page,
  visibility,
}: {
  kind?: MediaKind;
  limit: number;
  offset: number;
  page: number;
  visibility?: LibraryVisibility;
}) {
  "use cache: private";

  const { assets, total } = await listMedia({ kind, limit, offset, visibility });

  return (
    <>
      <AdminTableColumns
        columns={MEDIA_COLUMNS}
        emptyLabel="No media found."
        isEmpty={assets.length === 0}
      >
        {assets.map((asset) => (
          <MediaRow asset={asset} key={asset.id} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/media"
        limit={limit}
        page={page}
        queryParams={{ kind, visibility }}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function MediaListSkeleton() {
  return <AdminTableColumnsSkeleton columns={MEDIA_COLUMNS} />;
}
