import { createBooleanEvaluation } from "@/lib/evaluation-routes";
import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { pictureNeedClassifier } from "@zoonk/ai/tasks/v2/lesson-spec/picture-need";
import { type PictureNeedExpected, type PictureNeedInput, TEST_CASES } from "./test-cases";

type PictureNeedOutput = { teaches: boolean };

const route = createBooleanEvaluation({
  classifier: pictureNeedClassifier,
  toOutput: (teaches): PictureNeedOutput => ({ teaches }),
});

function toLabel(teaches: boolean | undefined): string {
  return teaches ? "teaches" : "decorative";
}

const scorePictureNeed: TaskScorer<PictureNeedExpected> = ({ output, testCase }) => {
  const { teaches } = JSON.parse(output) as PictureNeedOutput;
  const expected = testCase.expected?.teaches;
  const classification = { expected: toLabel(expected), predicted: toLabel(teaches) };

  return {
    ...createFixedScore({
      conclusion: `Expected ${classification.expected}; got ${classification.predicted}.`,
      score: teaches === expected ? 10 : 6,
    }),
    classification,
  };
};

/**
 * The check only runs as an evaluation question (Jev in production), so both routes ask the same
 * question through `experimental_decide`: a generation model id runs through the decision adapter.
 */
export const pictureNeedTask: Task<PictureNeedInput, PictureNeedOutput, PictureNeedExpected> = {
  description:
    "Decide whether a picture a lesson plan asked for teaches (the learner would otherwise have to imagine it) or only decorates, so decorative ones are dropped before they're drawn",
  evaluate: route,
  generate: route,
  id: "picture-need",
  name: "Picture Need",
  score: scorePictureNeed,
  testCases: TEST_CASES,
};
