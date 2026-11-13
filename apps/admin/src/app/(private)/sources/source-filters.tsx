import { AdminToolbar } from "@/components/admin-page";
import { AdminQuerySelect } from "@/components/admin-query-select";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { AdminTabs } from "@/components/admin-tabs";
import { VISIBILITY_FILTER_OPTIONS, buildEnumFilterOptions } from "@/lib/enum-filter-options";
import { buildSourceListHref, parseSourceListFilters } from "./_utils/source-list-params";

const KIND_OPTIONS = [
  { label: "Official", value: "official" as const },
  { label: "Secondary", value: "secondary" as const },
  { label: "Upload", value: "upload" as const },
];

export async function SourceFilters({ searchParams }: Pick<PageProps<"/sources">, "searchParams">) {
  const filters = parseSourceListFilters(await searchParams);

  return (
    <AdminToolbar>
      <AdminSearch placeholder="Search public sources by title…" />

      <AdminTabs
        label="Kind"
        options={buildEnumFilterOptions({
          allLabel: "All kinds",
          buildHref: (kind) => buildSourceListHref({ ...filters, kind }),
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

export function SourceFiltersSkeleton() {
  return (
    <AdminToolbar>
      <AdminSearchSkeleton />
    </AdminToolbar>
  );
}
