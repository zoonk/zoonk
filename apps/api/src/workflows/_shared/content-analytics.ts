import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { type CurriculumAnalytics } from "@zoonk/core/library/curriculum/scope";

/** Steps run in the workflow runtime's request, so they can't read the client that started the work. */
export type ContentAnalytics = {
  distinctId?: string;
  goalId?: string;
  platform?: AnalyticsPlatform | null;
};

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
