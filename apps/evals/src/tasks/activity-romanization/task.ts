import { type Task } from "@/lib/types";
import {
  type ActivityRomanizationParams,
  type ActivityRomanizationSchema,
  generateActivityRomanization,
} from "@zoonk/ai/tasks/activities/language/romanization";
import { TEST_CASES } from "./test-cases";

export const activityRomanizationTask: Task<
  ActivityRomanizationParams,
  ActivityRomanizationSchema
> = {
  description: "Romanize non-Roman script texts using standard transliteration systems",
  generate: generateActivityRomanization,
  id: "activity-romanization",
  name: "Activity Romanization",
  testCases: TEST_CASES,
};
