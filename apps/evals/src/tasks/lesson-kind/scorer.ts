import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type LessonKindSchema } from "@zoonk/ai/tasks/lessons/kind";

export type LessonKindExpected = Pick<LessonKindSchema, "kind">;

/**
 * Scores lesson-kind classification from the exact structured kind. The output
 * schema has one meaningful field, so a model either matches the expected
 * learning approach completely or receives the deterministic minimum score.
 */
export const scoreLessonKind = createDeterministicStringFieldScorer<LessonKindExpected>({
  expectedLabel: "Expected lesson kind",
  field: "kind",
  generatedLabel: "Generated lesson kind",
  getAcceptedValues: (expected) => (expected ? [expected.kind] : []),
});
