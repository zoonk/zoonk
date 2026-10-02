import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type WorkFieldResult } from "@zoonk/ai/tasks/v2/items/work-field";

/** The field the case expects, and any other field that would set practice just as well. */
export type WorkFieldExpected = {
  field: WorkFieldResult["field"];
  alsoAccepted?: WorkFieldResult["field"][];
};

/**
 * Scores the picked field against the labeled one. Practice is shared per field, so a wrong field
 * sets a learner's questions in someone else's job: exact match (or an equally good field) only.
 */
export const scoreWorkField = createDeterministicStringFieldScorer<WorkFieldExpected>({
  expectedLabel: "Expected field",
  field: "field",
  generatedLabel: "Generated field",
  getAcceptedValues: (expected) =>
    expected ? [expected.field, ...(expected.alsoAccepted ?? [])] : [],
  reportsLabels: true,
});
