import { readDatasetImage } from "@/lib/image-files";
import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type Reasoning } from "@zoonk/ai/provider-options";
import { type ImageCheckVerdict, checkLessonImage } from "@zoonk/ai/tasks/v2/images/check";
import { type ImageCheckCaseInput, type ImageCheckExpected, TEST_CASES } from "./test-cases";

const TASK_ID = "image-check";
const CORRECT_SCORE = 10;
const WRONG_SCORE = 6;

function toLabel(passed: boolean | undefined): string {
  return passed ? "pass" : "fail";
}

/** Accuracy per label: letting a broken image through and rejecting a good one cost differently. */
const scoreImageCheck: TaskScorer<ImageCheckExpected> = ({ output, testCase }) => {
  const { passed, problems } = JSON.parse(output) as ImageCheckVerdict;

  const classification = {
    expected: toLabel(testCase.expected?.passed),
    predicted: toLabel(passed),
  };

  return {
    ...createFixedScore({
      conclusion: `Expected ${classification.expected}; got ${classification.predicted}. ${problems.join(" ")}`,
      score: classification.expected === classification.predicted ? CORRECT_SCORE : WRONG_SCORE,
    }),
    classification,
  };
};

async function generate({
  imageFile,
  language,
  model,
  reasoning,
  scene,
  useFallback,
}: ImageCheckCaseInput & { model: string; reasoning?: Reasoning; useFallback?: boolean }) {
  const data = await readDatasetImage({ fileName: imageFile, taskId: TASK_ID });
  const image = { data, mediaType: "image/webp" };
  return checkLessonImage({ image, language, model, reasoning, scene, useFallback });
}

/**
 * The vision check every image passes before a lesson uses it. Cases are
 * images from the lesson-image eval labeled by hand, and planted failures.
 */
export const imageCheckTask: Task<ImageCheckCaseInput, ImageCheckVerdict, ImageCheckExpected> = {
  description:
    "Decide whether a generated lesson image shows its scene, is on style and has correct text",
  generate,
  id: TASK_ID,
  name: "Image Check",
  score: scoreImageCheck,
  testCases: TEST_CASES,
};
