import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type CourseIntent } from "@zoonk/ai/tasks/courses/intent";

export type CourseIntentExpected = { intents: readonly CourseIntent[] };

export const scoreCourseIntent = createDeterministicStringFieldScorer<CourseIntentExpected>({
  expectedLabel: "Expected intent",
  field: "intent",
  generatedLabel: "Generated intent",
  getAcceptedValues: (expected) => expected?.intents ?? [],
});
