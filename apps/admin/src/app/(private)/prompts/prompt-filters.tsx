import { AdminToolbar } from "@/components/admin-page";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { AdminTabs } from "@/components/admin-tabs";
import { PROMPT_OUTCOMES, type PromptOutcome } from "@/data/prompts/_utils/prompt-outcomes";
import { buildAdminHref } from "@/lib/admin-href";
import { buildEnumFilterOptions } from "@/lib/enum-filter-options";
import { parseSearchParams } from "@/lib/parse-search-params";
import { parsePromptOutcome, promptOutcomeLabels } from "./_utils/prompt-labels";

export async function PromptFilters({ searchParams }: Pick<PageProps<"/prompts">, "searchParams">) {
  const params = await searchParams;
  const { search } = parseSearchParams(params);

  return (
    <AdminToolbar>
      <AdminSearch placeholder="Search requests, names, or emails…" />

      <AdminTabs
        label="Outcome"
        options={buildEnumFilterOptions<PromptOutcome>({
          allLabel: "All",
          buildHref: (outcome) => buildAdminHref({ params: { outcome, search }, path: "/prompts" }),
          current: parsePromptOutcome(params),
          options: PROMPT_OUTCOMES.map((value) => ({ label: promptOutcomeLabels[value], value })),
        })}
      />
    </AdminToolbar>
  );
}

export function PromptFiltersSkeleton() {
  return (
    <AdminToolbar>
      <AdminSearchSkeleton />
    </AdminToolbar>
  );
}
