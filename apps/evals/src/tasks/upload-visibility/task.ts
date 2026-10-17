import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type Task } from "@/lib/types";
import {
  type UploadVisibility,
  type UploadVisibilityParams,
  classifyUploadVisibility,
} from "@zoonk/ai/tasks/v2/research/upload-visibility";
import { TEST_CASES } from "./test-cases";

export type UploadVisibilityExpected = { visibility: "public" | "private" };

export const uploadVisibilityTask: Task<
  UploadVisibilityParams,
  UploadVisibility,
  UploadVisibilityExpected
> = {
  description:
    "Decide whether an upload is a document its publisher made public or must stay private",
  generate: classifyUploadVisibility,
  id: "upload-visibility",
  name: "Upload Visibility",
  score: createDeterministicStringFieldScorer<UploadVisibilityExpected>({
    expectedLabel: "Expected visibility",
    field: "visibility",
    generatedLabel: "Generated visibility",
    getAcceptedValues: (expected) => (expected ? [expected.visibility] : []),
    // The title and publisher feed the search that confirms a public upload; only the verdict is scored.
    otherOutputFields: ["documentKind", "language", "publisher", "title"],
    reportsLabels: true,
  }),
  testCases: TEST_CASES,
};
