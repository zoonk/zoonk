import { createBooleanEvaluation } from "@/lib/evaluation-routes";
import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { questionGeneralityClassifier } from "@zoonk/ai/tasks/v2/explain/question-generality";
import {
  type QuestionGeneralityExpected,
  type QuestionGeneralityInput,
  TEST_CASES,
} from "./test-cases";

type QuestionGeneralityOutput = { isGeneral: boolean };

const route = createBooleanEvaluation({
  classifier: questionGeneralityClassifier,
  toOutput: (isGeneral): QuestionGeneralityOutput => ({ isGeneral }),
});

function toLabel(isGeneral: boolean | undefined): string {
  return isGeneral ? "general" : "personal";
}

const scoreQuestionGenerality: TaskScorer<QuestionGeneralityExpected> = ({ output, testCase }) => {
  const { isGeneral } = JSON.parse(output) as QuestionGeneralityOutput;
  const expected = testCase.expected?.isGeneral;
  const classification = { expected: toLabel(expected), predicted: toLabel(isGeneral) };

  return {
    ...createFixedScore({
      conclusion: `Expected ${classification.expected}; got ${classification.predicted}.`,
      score: isGeneral === expected ? 10 : 6,
    }),
    classification,
  };
};

/**
 * The classifier only runs as an evaluation question (Jev in production), so
 * both routes ask the same question through `experimental_evaluate`: a
 * generation model id runs through the evaluation adapter.
 */
export const questionGeneralityTask: Task<
  QuestionGeneralityInput,
  QuestionGeneralityOutput,
  QuestionGeneralityExpected
> = {
  description:
    "Decide whether a quick-explanation question is general (shared by everyone who asks it) or personal (made only for the asker)",
  evaluate: route,
  generate: route,
  id: "question-generality",
  name: "Question Generality",
  score: scoreQuestionGenerality,
  testCases: TEST_CASES,
};
