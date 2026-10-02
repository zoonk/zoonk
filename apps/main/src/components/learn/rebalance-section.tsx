import { getRecentRebalance } from "@zoonk/core/plans/recent-rebalance";
import { type LearnBuddy } from "@zoonk/learn/navigation";
import { RebalanceNoteClient } from "./rebalance-note-client";

/**
 * The plan's latest rebalance this week, as one line on Today and Progress: Fun's buddy says it,
 * Focus shows the plan change. Nothing renders without one.
 */
export async function RebalanceSection({
  goalId,
  buddy,
}: {
  goalId: string;
  buddy: LearnBuddy | null;
}) {
  const result = await getRecentRebalance(goalId);

  if (result.status !== "ready" || !result.change) {
    return null;
  }

  return <RebalanceNoteClient change={result.change} goalId={goalId} buddy={buddy} />;
}
