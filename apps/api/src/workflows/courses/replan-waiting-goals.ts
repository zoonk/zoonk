import { safeAsync } from "@zoonk/utils/error";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { retryPlanConflicts } from "../_shared/plan-conflict-retry";
import {
  listWaitingGoalsStep,
  logReplanFailureStep,
  replanWaitingGoalStep,
} from "./steps/course-outline-steps";

/**
 * A goal that still fails to re-plan leaves the band written, not failed: its plan stays usable on
 * stand-ins until its next refresh.
 */
export async function replanWaitingGoals({
  context,
  goalIds,
  skillIds,
}: {
  context: { analytics?: ContentAnalytics; courseId: string };
  goalIds: string[];
  skillIds: string[];
}): Promise<void> {
  const listed = await listWaitingGoalsStep({ goalIds, skillIds });
  const initiating = context.analytics?.goalId;

  const waiting =
    initiating && listed.includes(initiating)
      ? [initiating, ...listed.filter((id) => id !== initiating)]
      : listed;

  const conflicts: string[] = [];
  const failures: { goalId: string; reason: unknown }[] = [];

  for (const goalId of waiting) {
    // oxlint-disable-next-line no-await-in-loop -- Bound the transactions started for a popular course's waiting plans.
    const { data, error } = await safeAsync(() => replanWaitingGoalStep(goalId));

    if (error) {
      failures.push({ goalId, reason: error });
    } else if (data.conflict) {
      conflicts.push(goalId);
    }
  }

  for (const goalId of conflicts) {
    // oxlint-disable-next-line no-await-in-loop -- Healthy goals have already been planned before durable conflict retries wait.
    const { error } = await safeAsync(() => retryPlanConflicts(replanWaitingGoalStep, goalId));

    if (error) {
      failures.push({ goalId, reason: error });
    }
  }

  const [first] = failures;

  if (first) {
    await Promise.all([
      logReplanFailureStep({
        courseId: context.courseId,
        error: first.reason instanceof Error ? first.reason.message : String(first.reason),
        goalIds: failures.map(({ goalId }) => goalId),
        skillIds,
      }),
      trackGenerationFailedStep({
        analytics: context.analytics,
        contentKind: "course",
        task: "waiting-goals-replan",
      }),
    ]);
  }
}
