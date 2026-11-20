import { type Task } from "@/lib/types";
import {
  type PassMarkTranslations,
  type TranslatePassMarksParams,
  translatePassMarks,
} from "@zoonk/ai/tasks/research/translate-pass-marks";
import { TEST_CASES } from "./test-cases";

export const translatePassMarksTask: Task<TranslatePassMarksParams, PassMarkTranslations> = {
  criteria: [],
  description: "Translate an exam's pass marks into the app's languages when its notice is read",
  generate: translatePassMarks,
  id: "translate-pass-marks",
  name: "Translate pass marks",
  priorities: {
    comparison: { criteria: {}, preference: "separates", trade: null },
    distribution: "shared",
    first: "cost",
    reads: "A learner reads the translated pass marks",
    reason: "Code checks the numbers; the cheapest that kept every number",
    waits: "A learner waits on a new exam; refreshes in the background",
  },
  testCases: TEST_CASES,
};
