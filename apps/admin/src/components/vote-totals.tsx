import { type VoteTotals } from "@/data/feedback/get-vote-totals";
import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";

/**
 * Up and down votes side by side, so a screen with many downvotes stands out
 * in a table without reading two columns.
 */
export function VoteTotalsLabel({ totals }: { totals: VoteTotals }) {
  if (totals.up === 0 && totals.down === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs tabular-nums">
      <span className="inline-flex items-center gap-0.5" title="Helpful">
        <ThumbsUpIcon aria-label="Helpful" className="size-3" />
        {totals.up}
      </span>
      <span
        className={
          totals.down > 0
            ? "text-destructive inline-flex items-center gap-0.5"
            : "inline-flex items-center gap-0.5"
        }
        title="Not helpful"
      >
        <ThumbsDownIcon aria-label="Not helpful" className="size-3" />
        {totals.down}
      </span>
    </span>
  );
}
