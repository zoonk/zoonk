import { type VoteValue } from "@zoonk/db";
import { Badge } from "@zoonk/ui/components/badge";
import { voteLabels } from "./_utils/feedback-labels";

export function FeedbackVoteBadge({ vote }: { vote: VoteValue | null }) {
  if (!vote) {
    return <span className="text-muted-foreground text-xs">No vote</span>;
  }

  return <Badge variant={vote === "down" ? "destructive" : "success"}>{voteLabels[vote]}</Badge>;
}
