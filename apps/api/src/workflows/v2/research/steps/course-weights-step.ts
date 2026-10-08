import { findCourseWeights } from "@zoonk/ai/tasks/v2/research/find-course-weights";
import {
  findCourseWeightsLookup,
  recordCourseWeights,
} from "@zoonk/core/goals/course-weights-research";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/**
 * For an entrance exam goal that names its course and institution (Medicina at UFMG), how that
 * course weighs each part of the exam there, looked up once and stored on the goal: the plan gives
 * the parts the course counts more their share of the time. The weights only add to the plan, so
 * a lookup that fails is logged and tried again by the goal's next research run.
 */
export async function lookUpCourseWeightsStep({
  analytics,
  goalId,
}: {
  analytics: ResearchAnalytics;
  goalId: string;
}): Promise<void> {
  "use step";

  const { error } = await safeAsync(async () => {
    const lookup = await findCourseWeightsLookup({ goalId });

    if (!lookup) {
      return;
    }

    const { data } = await withAiRetry(() =>
      findCourseWeights({
        ...lookup,
        analytics,
        today: new Date().toISOString().slice(0, "YYYY-MM-DD".length),
      }),
    );

    await recordCourseWeights({ finding: data, goalId, lookup });
  });

  if (error) {
    logError(`The course weights of goal ${goalId} couldn't be looked up:`, error);
  }
}
