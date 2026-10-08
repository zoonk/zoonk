import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { type CurriculumAnalytics } from "@zoonk/core/library/curriculum/scope";

/**
 * Who content is being made for: the learner and goal that caused the work, and the client whose
 * request started it (steps run in the workflow runtime's request, so they can't read it).
 */
export type ContentAnalytics = {
  distinctId?: string;
  goalId?: string;
  platform?: AnalyticsPlatform | null;
};

/**
 * The AI cost context for content a workflow writes. Shared Library content is counted as shared
 * even though one learner caused it; a private course's content is personal to its owner. Every
 * call of a run shares the run as its trace.
 */
export function toContentAnalytics({
  analytics,
  scope,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  scope: { ownerId: string | null };
  workflowRunId: string;
}): NonNullable<CurriculumAnalytics> {
  return {
    ...analytics,
    contentScope: scope.ownerId ? "personal" : "shared",
    traceId: workflowRunId,
  };
}
