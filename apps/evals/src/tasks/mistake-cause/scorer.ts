import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type MistakeCauseSchema } from "@zoonk/ai/tasks/v2/mistakes/cause";

export type MistakeCauseExpected = Pick<MistakeCauseSchema, "cause">;

export const scoreMistakeCause = createDeterministicStringFieldScorer<MistakeCauseExpected>({
  expectedLabel: "Expected cause",
  field: "cause",
  generatedLabel: "Generated cause",
  getAcceptedValues: (expected) => (expected ? [expected.cause] : []),
});
