import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type MistakeCauseSchema } from "@zoonk/ai/tasks/v2/mistakes/cause";

export type MistakeCauseExpected = Pick<MistakeCauseSchema, "cause">;

/**
 * Scores the named cause against the labeled one. The cause picks the learner's next drill, so a
 * wrong label is a wrong drill: exact match or the deterministic minimum.
 */
export const scoreMistakeCause = createDeterministicStringFieldScorer<MistakeCauseExpected>({
  expectedLabel: "Expected cause",
  field: "cause",
  generatedLabel: "Generated cause",
  getAcceptedValues: (expected) => (expected ? [expected.cause] : []),
  reportsLabels: true,
});
