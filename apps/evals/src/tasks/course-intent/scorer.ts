import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type CourseIntent } from "@zoonk/ai/tasks/courses/intent";

export type CourseIntentExpected = { intents: readonly CourseIntent[] };

/**
 * Scores course-intent classification deterministically. If the generated kind is
 * one of the accepted kinds, the run gets 10; otherwise it gets 6. The same
 * score is applied to every score bucket to avoid judge-model drift.
 */
export const scoreCourseIntent = createDeterministicStringFieldScorer<CourseIntentExpected>({
  expectedLabel: "Expected intent",
  field: "intent",
  generatedLabel: "Generated intent",
  getAcceptedValues: (expected) => expected?.intents ?? [],
});
