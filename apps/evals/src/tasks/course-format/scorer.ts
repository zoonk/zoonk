import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type CourseFormat } from "@zoonk/ai/tasks/courses/format";

export type CourseFormatExpected = { courseFormats: readonly CourseFormat[] };

/**
 * Scores course-format classification deterministically. A run receives
 * 10 only when the generated format matches one accepted value and has no extra
 * fields; all other outputs receive 6 in every score bucket.
 */
export const scoreCourseFormat = createDeterministicStringFieldScorer<CourseFormatExpected>({
  expectedLabel: "Expected course format",
  field: "courseFormat",
  generatedLabel: "Generated course format",
  getAcceptedValues: (expected) => expected?.courseFormats ?? [],
});
