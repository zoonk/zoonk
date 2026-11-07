import { AdminFilterNav } from "@/components/admin-filter-nav";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { PROMPT_OUTCOMES, type PromptOutcome } from "@/data/prompts/_utils/prompt-outcomes";
import { buildAdminHref } from "@/lib/admin-href";
import { buildEnumFilterOptions } from "@/lib/enum-filter-options";
import { parseSearchParams } from "@/lib/parse-search-params";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { parsePromptOutcome, promptOutcomeLabels } from "./_utils/prompt-labels";

export async function PromptFilters({ searchParams }: Pick<PageProps<"/prompts">, "searchParams">) {
  const params = await searchParams;
  const { search } = parseSearchParams(params);

  return (
    <div className="flex flex-col gap-3">
      <AdminSearch placeholder="Search prompts, names, or emails…" />

      <AdminFilterNav
        label="Outcome"
        options={buildEnumFilterOptions<PromptOutcome>({
          allLabel: "All",
          buildHref: (outcome) => buildAdminHref({ params: { outcome, search }, path: "/prompts" }),
          current: parsePromptOutcome(params),
          options: PROMPT_OUTCOMES.map((value) => ({ label: promptOutcomeLabels[value], value })),
        })}
      />
    </div>
  );
}

export function PromptFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <AdminSearchSkeleton />
      <Skeleton className="h-8 w-full max-w-xl rounded-4xl" />
    </div>
  );
}
