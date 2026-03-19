import { type Task } from "@/lib/types";
import {
  type ActivitySentenceVariantsParams,
  type ActivitySentenceVariantsSchema,
  generateActivitySentenceVariants,
} from "@zoonk/ai/tasks/activities/language/sentence-variants";
import { TEST_CASES } from "./test-cases";

export const activitySentenceVariantsTask: Task<
  ActivitySentenceVariantsParams,
  ActivitySentenceVariantsSchema
> = {
  description: "Audit sentence pairs for strict accepted-answer variants",
  generate: generateActivitySentenceVariants,
  id: "activity-sentence-variants",
  name: "Activity Sentence Variants",
  testCases: TEST_CASES,
};
