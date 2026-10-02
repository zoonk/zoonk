import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { createChoiceEvaluation } from "@/lib/evaluation-routes";
import { type Task } from "@/lib/types";
import {
  type ChangingFactsParams,
  type ChangingFactsSchema,
  type ChangingFactsTopic,
  changingFactsClassifier,
  classifyChangingFacts,
} from "@zoonk/ai/tasks/v2/research/changing-facts";
import { TEST_CASES } from "./test-cases";

export type ChangingFactsExpected = { topics: readonly ChangingFactsTopic[] };

export const changingFactsTask: Task<
  ChangingFactsParams,
  ChangingFactsSchema,
  ChangingFactsExpected
> = {
  description:
    "Detect goals that depend on facts that change over time: exams, regulations or software versions",
  evaluate: createChoiceEvaluation({
    classifier: changingFactsClassifier,
    toOutput: (topic) => ({ topic }),
  }),
  generate: classifyChangingFacts,
  id: "changing-facts",
  name: "Changing Facts",
  score: createDeterministicStringFieldScorer<ChangingFactsExpected>({
    expectedLabel: "Expected topic",
    field: "topic",
    generatedLabel: "Generated topic",
    getAcceptedValues: (expected) => expected?.topics ?? [],
    reportsLabels: true,
  }),
  testCases: TEST_CASES,
};
