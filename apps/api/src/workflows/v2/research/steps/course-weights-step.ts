import { findCourseWeights } from "@zoonk/ai/tasks/v2/research/find-course-weights";
import {
  copyStoredCourseWeights,
  findCourseWeightsLookup,
  recordCourseWeights,
} from "@zoonk/core/goals/course-weights-research";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

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
