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

/**
 * The scope of a call that reads the research plan, or writes it. A plan made from the learner's
 * own words (a goal from their material) is theirs, even when the exam it names is shared, so those
 * calls count as personal and never reach providers that train on prompts.
 */
export function toPlanAnalytics({
  analytics,
  personal,
}: {
  analytics: ResearchAnalytics;
  personal: boolean;
}): ResearchAnalytics {
  return personal ? { ...analytics, contentScope: "personal" } : analytics;
}
