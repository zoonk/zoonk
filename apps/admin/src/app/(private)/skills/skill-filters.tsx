import { AdminToolbar } from "@/components/admin-page";
import { AdminQuerySelect } from "@/components/admin-query-select";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { AdminTabs } from "@/components/admin-tabs";
import { VISIBILITY_FILTER_OPTIONS, buildEnumFilterOptions } from "@/lib/enum-filter-options";
import { LANGUAGE_FILTER_OPTIONS } from "@/lib/language-filter";
import { buildSkillListHref, parseSkillListFilters } from "./_utils/skill-list-params";

const MERGED_OPTIONS = [{ label: "Show merged", value: "show" }];

export async function SkillFilters({ searchParams }: Pick<PageProps<"/skills">, "searchParams">) {
  const filters = parseSkillListFilters(await searchParams);

  return (
    <AdminToolbar>
      <AdminSearch placeholder="Search skills by name…" />

      <AdminTabs
        label="Who can see it"
        options={buildEnumFilterOptions({
          allLabel: "All",
          buildHref: (visibility) => buildSkillListHref({ ...filters, visibility }),
          current: filters.visibility,
          options: VISIBILITY_FILTER_OPTIONS,
        })}
      />

      <AdminQuerySelect
        allLabel="All languages"
        label="Language"
        name="language"
        options={LANGUAGE_FILTER_OPTIONS}
      />

      <AdminQuerySelect
        allLabel="Hide merged"
        label="Merged skills"
        name="merged"
        options={MERGED_OPTIONS}
      />
    </AdminToolbar>
  );
}

export function SkillFiltersSkeleton() {
  return (
    <AdminToolbar>
      <AdminSearchSkeleton />
    </AdminToolbar>
  );
}
