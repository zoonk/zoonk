import { type ChangingFactsParams } from "@zoonk/ai/tasks/v2/research/changing-facts";

export type ResearchAnalytics = NonNullable<ChangingFactsParams["analytics"]>;

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
 * A plan made from the learner's own words is theirs, even when the exam it names is shared, so it
 * counts as personal and never reaches providers that train on prompts.
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
