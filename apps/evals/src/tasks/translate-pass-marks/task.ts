import { type Task } from "@/lib/types";
import {
  type PassMarkTranslations,
  type TranslatePassMarksParams,
  translatePassMarks,
} from "@zoonk/ai/tasks/v2/research/translate-pass-marks";
import { TEST_CASES } from "./test-cases";

export const translatePassMarksTask: Task<TranslatePassMarksParams, PassMarkTranslations> = {
  description: "Translate an exam's pass marks into the app's languages when its notice is read",
  generate: translatePassMarks,
  id: "translate-pass-marks",
  name: "Translate Pass Marks",
  testCases: TEST_CASES,
};
