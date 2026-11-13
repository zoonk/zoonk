import { AdminToolbar } from "@/components/admin-page";
import { AdminQuerySelect } from "@/components/admin-query-select";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { AdminTabs } from "@/components/admin-tabs";
import { VISIBILITY_FILTER_OPTIONS, buildEnumFilterOptions } from "@/lib/enum-filter-options";
import { LANGUAGE_FILTER_OPTIONS } from "@/lib/language-filter";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { buildSkillListHref, parseSkillListFilters } from "./_utils/skill-list-params";

export async function SkillFilters({ searchParams }: Pick<PageProps<"/skills">, "searchParams">) {
  const filters = parseSkillListFilters(await searchParams);

  return (
    <div className="flex flex-col gap-3">
      <AdminSearch placeholder="Search skills by name…" />

      <AdminToolbar>
        <AdminQuerySelect
          allLabel="All languages"
          label="Language"
          name="language"
          options={LANGUAGE_FILTER_OPTIONS}
        />

        <AdminTabs
          label="Visibility"
          options={buildEnumFilterOptions({
            allLabel: "All",
            buildHref: (visibility) => buildSkillListHref({ ...filters, visibility }),
            current: filters.visibility,
            options: VISIBILITY_FILTER_OPTIONS,
          })}
        />

        <AdminTabs
          label="Merged skills"
          options={[
            {
              href: buildSkillListHref({ ...filters, includeMerged: false }),
              isActive: !filters.includeMerged,
              label: "Hide merged",
            },
            {
              href: buildSkillListHref({ ...filters, includeMerged: true }),
              isActive: filters.includeMerged,
              label: "Show merged",
            },
          ]}
        />
      </AdminToolbar>
    </div>
  );
}

export function SkillFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <AdminSearchSkeleton />
      <div className="flex gap-3">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-48 rounded-4xl" />
        <Skeleton className="h-8 w-48 rounded-4xl" />
      </div>
    </div>
  );
}
