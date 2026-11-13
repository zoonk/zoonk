import { AdminToolbar } from "@/components/admin-page";
import { AdminTabs } from "@/components/admin-tabs";
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
    <AdminToolbar>
      <AdminTabs
        label="Kind"
        options={buildEnumFilterOptions({
          allLabel: "All media",
          buildHref: (kind) => buildMediaListHref({ ...filters, kind }),
          current: filters.kind,
          options: KIND_OPTIONS,
        })}
      />

      <AdminTabs
        label="Visibility"
        options={buildEnumFilterOptions({
          allLabel: "All",
          buildHref: (visibility) => buildMediaListHref({ ...filters, visibility }),
          current: filters.visibility,
          options: VISIBILITY_FILTER_OPTIONS,
        })}
      />
    </AdminToolbar>
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
