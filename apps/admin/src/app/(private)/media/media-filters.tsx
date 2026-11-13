import { AdminToolbar } from "@/components/admin-page";
import { AdminQuerySelect } from "@/components/admin-query-select";
import { AdminTabs } from "@/components/admin-tabs";
import { VISIBILITY_FILTER_OPTIONS, buildEnumFilterOptions } from "@/lib/enum-filter-options";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { buildMediaListHref, parseMediaListFilters } from "./_utils/media-list-params";

const KIND_OPTIONS = [
  { label: "Pictures", value: "image" as const },
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

      <AdminQuerySelect
        allLabel="Public and private"
        label="Who can see it"
        name="visibility"
        options={VISIBILITY_FILTER_OPTIONS}
      />
    </AdminToolbar>
  );
}

export function MediaFiltersSkeleton() {
  return (
    <AdminToolbar>
      <Skeleton className="h-7.5 w-56 rounded-md" />
    </AdminToolbar>
  );
}
