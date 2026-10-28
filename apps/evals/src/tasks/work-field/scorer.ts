import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type WorkFieldResult } from "@zoonk/ai/tasks/v2/items/work-field";

export type WorkFieldExpected = {
  field: WorkFieldResult["field"];
  alsoAccepted?: WorkFieldResult["field"][];
};

export const scoreWorkField = createDeterministicStringFieldScorer<WorkFieldExpected>({
  expectedLabel: "Expected field",
  field: "field",
  generatedLabel: "Generated field",
  getAcceptedValues: (expected) =>
    expected ? [expected.field, ...(expected.alsoAccepted ?? [])] : [],
});
