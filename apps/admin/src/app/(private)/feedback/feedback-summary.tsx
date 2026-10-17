import { getContentFeedbackSummary } from "@/data/feedback/get-content-feedback-summary";
import { formatPercent } from "@/lib/format";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { parseContentFeedbackFilters } from "./_utils/feedback-filters";

const PERCENT = 100;

function SummaryFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Totals for the filtered votes, so a filter answers "how bad is it?" before reading rows. */
export async function FeedbackSummary({
  searchParams,
}: {
  searchParams: PageProps<"/feedback">["searchParams"];
}) {
  const filters = parseContentFeedbackFilters(await searchParams);
  const { down, up } = await getContentFeedbackSummary(filters);
  const votes = up + down;

  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <SummaryFigure label="Votes" value={votes.toLocaleString()} />
      <SummaryFigure label="Helpful" value={up.toLocaleString()} />
      <SummaryFigure label="Not helpful" value={down.toLocaleString()} />
      <SummaryFigure
        label="Downvote rate"
        value={formatPercent(votes > 0 ? (down / votes) * PERCENT : null)}
      />
    </dl>
  );
}

export function FeedbackSummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {["votes", "up", "down", "rate"].map((key) => (
        <div className="flex flex-col gap-1.5" key={key}>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}
