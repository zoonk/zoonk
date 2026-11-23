import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { type PlanSummary } from "./plan-summary";

export async function owePlanSuggestion({
  goal,
  owe = oweFollowUps,
  summary,
  tx,
}: {
  goal: Pick<Goal, "id" | "userId">;
  owe?: typeof oweFollowUps;
  summary?: PlanSummary | null;
  tx: TransactionClient;
}): Promise<void> {
  if (summary?.advice.suggestionPending) {
    await owe({
      db: tx,
      followUps: [{ input: { goalId: goal.id }, kind: "refreshPlanSuggestion" }],
      userId: goal.userId,
    });
  }
}
