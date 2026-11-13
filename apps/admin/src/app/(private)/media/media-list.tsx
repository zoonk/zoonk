import { AdminSectionEmpty } from "@/components/admin-section";
import { AdminPagination } from "@/components/pagination";
import { type ListedMediaAsset, listMedia } from "@/data/media/list-media";
import { languageName } from "@/lib/language-filter";
import { parseSearchParams } from "@/lib/parse-search-params";
import { type LibraryVisibility, type MediaKind } from "@zoonk/db";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import Link from "next/link";
import { formatMediaUsage } from "./_utils/media-format";
import { parseMediaListFilters } from "./_utils/media-list-params";
import { MediaPreview } from "./media-preview";

/** Pictures are compared by looking, so they are laid out as a gallery, not as rows. */
const GALLERY_CLASS =
  "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

const SKELETON_CARDS = 12;

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

  if (assets.length === 0) {
    return <AdminSectionEmpty>No media yet.</AdminSectionEmpty>;
  }

  return (
    <>
      <ul className={GALLERY_CLASS}>
        {assets.map((asset) => (
          <li key={asset.id}>
            <MediaCard asset={asset} />
          </li>
        ))}
      </ul>

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

/** The picture, the lesson that shows it, and one quiet line: its language and how much it is used. */
function MediaCard({ asset }: { asset: ListedMediaAsset }) {
  return (
    <Link
      className="group focus-visible:ring-ring flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
      href={`/media/${asset.id}`}
      prefetch
    >
      <span className="transition-opacity group-hover:opacity-80">
        <MediaPreview asset={asset} size="card" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{asset.usedIn ?? "Not in a lesson"}</span>
        <span className="text-muted-foreground truncate text-xs">
          {[
            asset.language ? languageName(asset.language) : null,
            formatMediaUsage(asset._count.steps),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </Link>
  );
}

export function MediaListSkeleton() {
  return (
    <div aria-hidden="true" className={GALLERY_CLASS}>
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <div className="flex flex-col gap-2" key={index}>
          <Skeleton className="aspect-4/5 w-full rounded-lg" />
          <span className="flex h-9 flex-col justify-center gap-1.5">
            <Skeleton className="h-3.5 w-28 max-w-full" />
            <Skeleton className="h-3 w-20" />
          </span>
        </div>
      ))}
    </div>
  );
}
