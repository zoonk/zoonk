import { type ChangingFactsParams } from "@zoonk/ai/tasks/v2/research/changing-facts";

/** Who a research call ran for, so its cost is summed per learner, goal and run. */
export type ResearchAnalytics = NonNullable<ChangingFactsParams["analytics"]>;

/**
 * Research builds shared content (a blueprint or a source everyone reuses), so
 * its cost is shared even though one learner triggered it. Freshness checks
 * run for nobody in particular.
 */
export function toResearchAnalytics({
  goal,
  runId,
}: {
  goal: { id: string; userId: string } | null;
  runId: string;
}): ResearchAnalytics {
  return { contentScope: "shared", distinctId: goal?.userId, goalId: goal?.id, traceId: runId };
}
