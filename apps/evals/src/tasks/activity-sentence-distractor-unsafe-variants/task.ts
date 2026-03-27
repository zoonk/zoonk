import { type Task } from "@/lib/types";
import {
  type ActivitySentenceDistractorUnsafeVariantsParams,
  type ActivitySentenceDistractorUnsafeVariantsSchema,
  generateActivitySentenceDistractorUnsafeVariants,
} from "@zoonk/ai/tasks/activities/language/sentence-distractor-unsafe-variants";
import { TEST_CASES } from "./test-cases";

export const activitySentenceDistractorUnsafeVariantsTask: Task<
  ActivitySentenceDistractorUnsafeVariantsParams,
  ActivitySentenceDistractorUnsafeVariantsSchema
> = {
  description: "Audit sentence pairs for distractor-unsafe sentence variants",
  generate: generateActivitySentenceDistractorUnsafeVariants,
  id: "activity-sentence-distractor-unsafe-variants",
  name: "Sentence Distractor Safety",
  testCases: TEST_CASES,
};
