import { AdminFilterNav } from "@/components/admin-filter-nav";
import { AdminQuerySelect } from "@/components/admin-query-select";
import { type ContentFeedbackFilters } from "@/data/feedback/_utils/content-feedback-where";
import { listContentFeedbackFilterOptions } from "@/data/feedback/list-content-feedback-filter-options";
import { buildAdminHref } from "@/lib/admin-href";
import { buildEnumFilterOptions } from "@/lib/enum-filter-options";
import { type VoteValue } from "@zoonk/db";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  parseContentFeedbackFilters,
  toContentFeedbackQueryParams,
} from "./_utils/feedback-filters";
import {
  feedbackContentKindLabels,
  feedbackReasonLabels,
  voteLabels,
} from "./_utils/feedback-labels";

function toSelectOptions(labels: Record<string, string>) {
  return Object.entries(labels).map(([value, label]) => ({ label, value }));
}

function toValueOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

/** Switching the vote keeps the other filters and returns to the first page. */
function VoteFilter({ filters }: { filters: ContentFeedbackFilters }) {
  return (
    <AdminFilterNav
      label="Vote filter"
      options={buildEnumFilterOptions<VoteValue>({
        allLabel: "All votes",
        buildHref: (vote) =>
          buildAdminHref({
            params: { ...toContentFeedbackQueryParams(filters), vote },
            path: "/feedback",
          }),
        current: filters.vote,
        options: [
          { label: voteLabels.up, value: "up" },
          { label: voteLabels.down, value: "down" },
        ],
      })}
    />
  );
}

export async function FeedbackFilters({
  searchParams,
}: {
  searchParams: PageProps<"/feedback">["searchParams"];
}) {
  const [params, options] = await Promise.all([searchParams, listContentFeedbackFilterOptions()]);
  const filters = parseContentFeedbackFilters(params);

  return (
    <div className="flex flex-col gap-3">
      <VoteFilter filters={filters} />

      <div className="flex flex-wrap gap-2">
        <AdminQuerySelect
          allLabel="All content"
          label="Content kind"
          name="kind"
          options={toSelectOptions(feedbackContentKindLabels)}
        />
        <AdminQuerySelect
          allLabel="All reasons"
          label="Reason"
          name="reason"
          options={toSelectOptions(feedbackReasonLabels)}
        />
        <AdminQuerySelect
          allLabel="All models"
          label="Model"
          name="model"
          options={toValueOptions(options.models)}
        />
        <AdminQuerySelect
          allLabel="All prompt versions"
          label="Prompt version"
          name="promptVersion"
          options={toValueOptions(options.promptVersions)}
        />
      </div>
    </div>
  );
}

export function FeedbackFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        <Skeleton className="h-7 w-20 rounded-4xl" />
        <Skeleton className="h-7 w-20 rounded-4xl" />
        <Skeleton className="h-7 w-24 rounded-4xl" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-7 w-40" />
      </div>
    </div>
  );
}
