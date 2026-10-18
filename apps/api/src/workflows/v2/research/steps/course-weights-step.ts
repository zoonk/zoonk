import { findCourseWeights } from "@zoonk/ai/tasks/v2/research/find-course-weights";
import {
  copyStoredCourseWeights,
  findCourseWeightsLookup,
  recordCourseWeights,
} from "@zoonk/core/goals/course-weights-research";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/**
 * For an entrance exam goal that names its course and institution (Medicina at UFMG), how that
 * course weighs each part of the exam there, looked up once a year and shared by every learner
 * aiming there: a goal whose course another learner's research already looked up this year gets
 * those weights with no call. The plan gives the parts the course counts more their share of the
 * time. A failure throws, so the runtime retries the step; the weights only add to the plan, so
 * research goes on when the retries run out, and the goal's next research run tries again.
 */
export async function lookUpCourseWeightsStep({
  analytics,
  goalId,
}: {
  analytics: ResearchAnalytics;
  goalId: string;
}): Promise<void> {
  "use step";

  const now = new Date();
  const lookup = await findCourseWeightsLookup({ goalId, year: now.getUTCFullYear() });

  if (!lookup || (await copyStoredCourseWeights({ goalId, lookup }))) {
    return;
  }

  const { data, provenance } = await withAiRetry(() =>
    findCourseWeights({
      analytics,
      course: lookup.course,
      exam: lookup.exam,
      institution: lookup.institution,
      subjects: lookup.subjects,
      today: now.toISOString().slice(0, "YYYY-MM-DD".length),
    }),
  );

  await recordCourseWeights({ finding: data, goalId, lookup, provenance });
}
