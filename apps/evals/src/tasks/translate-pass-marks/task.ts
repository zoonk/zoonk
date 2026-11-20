import { type Task } from "@/lib/types";
import {
  type PassMarkTranslations,
  type TranslatePassMarksParams,
  translatePassMarks,
} from "@zoonk/ai/tasks/research/translate-pass-marks";
import { TEST_CASES } from "./test-cases";

export const translatePassMarksTask: Task<TranslatePassMarksParams, PassMarkTranslations> = {
  criteria: [
    {
      expectations:
        "Every line is translated in order, one for one, and every number, score, percentage and official grade is kept exactly, with nothing converted, rounded, added up, explained or promised. Notice a changed or dropped number, a merged line, a lost grade, or added advice. Cost: a learner preparing for the exam reads the wrong bar to pass.",
      id: "numbersKept",
      label: "Every number and condition kept",
    },
    {
      expectations:
        "Each translation reads the way that language writes an exam rule, with its own word for terms such as group or test and its own decimal mark. Notice word-for-word phrasing, a term left in the source language without reason, or a stiff sentence. Cost: the learner has to work out what the rule means.",
      id: "natural",
      label: "Natural in each language",
    },
  ],
  description: "Translate an exam's pass marks into the app's languages when its notice is read",
  generate: translatePassMarks,
  id: "translate-pass-marks",
  name: "Translate pass marks",
  priorities: {
    comparison: {
      criteria: { natural: "counts", numbersKept: "disqualifies" },
      preference: "separates",
      trade: null,
    },
    distribution: "shared",
    first: "cost",
    reads: "A learner reads the translated pass marks",
    reason:
      "A wrong number misleads everyone sitting the exam; the cheapest that keeps every number",
    waits: "A learner waits on a new exam; refreshes in the background",
  },
  testCases: TEST_CASES,
};
