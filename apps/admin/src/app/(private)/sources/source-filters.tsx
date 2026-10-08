import { AdminFilterNav } from "@/components/admin-filter-nav";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { VISIBILITY_FILTER_OPTIONS, buildEnumFilterOptions } from "@/lib/enum-filter-options";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { buildSourceListHref, parseSourceListFilters } from "./_utils/source-list-params";

const KIND_OPTIONS = [
  { label: "Official", value: "official" as const },
  { label: "Secondary", value: "secondary" as const },
  { label: "Upload", value: "upload" as const },
];

/** Search (public titles only), kind and visibility filters, all kept in the URL. */
export async function SourceFilters({ searchParams }: Pick<PageProps<"/sources">, "searchParams">) {
  const filters = parseSourceListFilters(await searchParams);

  return (
    <div className="flex flex-col gap-3">
      <AdminSearch placeholder="Search public sources by title..." />

      <div className="flex flex-wrap items-center gap-3">
        <AdminFilterNav
          label="Kind"
          options={buildEnumFilterOptions({
            allLabel: "All kinds",
            buildHref: (kind) => buildSourceListHref({ ...filters, kind }),
            current: filters.kind,
            options: KIND_OPTIONS,
          })}
        />

        <AdminFilterNav
          label="Visibility"
          options={buildEnumFilterOptions({
            allLabel: "All",
            buildHref: (visibility) => buildSourceListHref({ ...filters, visibility }),
            current: filters.visibility,
            options: VISIBILITY_FILTER_OPTIONS,
          })}
        />
      </div>
    </div>
  );
}

export function SourceFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <AdminSearchSkeleton />
      <div className="flex gap-3">
        <Skeleton className="h-8 w-72 rounded-4xl" />
        <Skeleton className="h-8 w-48 rounded-4xl" />
      </div>
    </div>
  );
}
