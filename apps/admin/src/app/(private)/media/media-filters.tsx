import { AdminFilterNav } from "@/components/admin-filter-nav";
import { VISIBILITY_FILTER_OPTIONS, buildEnumFilterOptions } from "@/lib/enum-filter-options";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { buildMediaListHref, parseMediaListFilters } from "./_utils/media-list-params";

const KIND_OPTIONS = [
  { label: "Images", value: "image" as const },
  { label: "Audio", value: "audio" as const },
];

export async function MediaFilters({ searchParams }: Pick<PageProps<"/media">, "searchParams">) {
  const filters = parseMediaListFilters(await searchParams);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <AdminFilterNav
        label="Kind"
        options={buildEnumFilterOptions({
          allLabel: "All media",
          buildHref: (kind) => buildMediaListHref({ ...filters, kind }),
          current: filters.kind,
          options: KIND_OPTIONS,
        })}
      />

      <AdminFilterNav
        label="Visibility"
        options={buildEnumFilterOptions({
          allLabel: "All",
          buildHref: (visibility) => buildMediaListHref({ ...filters, visibility }),
          current: filters.visibility,
          options: VISIBILITY_FILTER_OPTIONS,
        })}
      />
    </div>
  );
}

export function MediaFiltersSkeleton() {
  return (
    <div className="flex gap-3">
      <Skeleton className="h-8 w-56 rounded-4xl" />
      <Skeleton className="h-8 w-48 rounded-4xl" />
    </div>
  );
}
