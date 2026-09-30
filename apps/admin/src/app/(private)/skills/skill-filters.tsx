import { AdminFilterNav } from "@/components/admin-filter-nav";
import { AdminQuerySelect } from "@/components/admin-query-select";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { VISIBILITY_FILTER_OPTIONS, buildEnumFilterOptions } from "@/lib/enum-filter-options";
import { LANGUAGE_FILTER_OPTIONS } from "@/lib/language-filter";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { buildSkillListHref, parseSkillListFilters } from "./_utils/skill-list-params";

/**
 * Search, language, visibility and merged-skill filters. They read the URL, so
 * only this row waits for it while the page heading stays static.
 */
export async function SkillFilters({ searchParams }: Pick<PageProps<"/skills">, "searchParams">) {
  const filters = parseSkillListFilters(await searchParams);

  return (
    <div className="flex flex-col gap-3">
      <AdminSearch placeholder="Search skills by name..." />

      <div className="flex flex-wrap items-center gap-3">
        <AdminQuerySelect
          allLabel="All languages"
          label="Language"
          name="language"
          options={LANGUAGE_FILTER_OPTIONS}
        />

        <AdminFilterNav
          label="Visibility"
          options={buildEnumFilterOptions({
            allLabel: "All",
            buildHref: (visibility) => buildSkillListHref({ ...filters, visibility }),
            current: filters.visibility,
            options: VISIBILITY_FILTER_OPTIONS,
          })}
        />

        <AdminFilterNav
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
      </div>
    </div>
  );
}

/** Keeps the search box and filter row footprint while the URL resolves. */
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
