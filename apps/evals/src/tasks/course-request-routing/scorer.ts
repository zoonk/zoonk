import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type CourseRequestScope } from "@zoonk/ai/tasks/courses/request-routing";

export type CourseRequestRoutingExpected = { scopes: readonly CourseRequestScope[] };

/**
 * Scores routing as a deterministic classification task. If the generated
 * scope is one of the accepted scopes, the run gets 10; otherwise it gets 6.
 * The same score is applied to every score bucket to avoid judge-model drift.
 */
export const scoreCourseRequestRouting =
  createDeterministicStringFieldScorer<CourseRequestRoutingExpected>({
    expectedLabel: "Expected scope",
    field: "scope",
    generatedLabel: "Generated scope",
    getAcceptedValues: (expected) => expected?.scopes ?? [],
  });
