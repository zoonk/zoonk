import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type LearnRequestClassification } from "@zoonk/ai/tasks/courses/learn-classification";

export type CourseLearnClassificationExpected = {
  classifications: readonly LearnRequestClassification[];
};

/**
 * Scores learn classification deterministically. A run receives 10 only when
 * the generated classification matches one accepted value and has no extra
 * fields; all other outputs receive 6 in every score bucket.
 */
export const scoreCourseLearnClassification =
  createDeterministicStringFieldScorer<CourseLearnClassificationExpected>({
    expectedLabel: "Expected classification",
    field: "classification",
    generatedLabel: "Generated classification",
    getAcceptedValues: (expected) => expected?.classifications ?? [],
  });
