import { readDatasetImage } from "@/lib/image-files";
import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type Reasoning } from "@zoonk/ai/provider-options";
import {
  type MaterialTranscription,
  transcribeMaterial,
} from "@zoonk/ai/tasks/material/transcribe";
import { renderPhotoPage } from "@zoonk/core/library/sources/render-photo-page";
import { TEST_CASES, type TranscribeMaterialCaseInput } from "./test-cases";
import { type TranscribeMaterialExpected, checkTranscription } from "./transcription-checks";

const TASK_ID = "transcribe-material";
const MIN_SCORE = 6;
const SCORE_RANGE = 4;

const scoreTranscription: TaskScorer<TranscribeMaterialExpected> = ({ output, testCase }) => {
  const { text } = JSON.parse(output) as MaterialTranscription;
  const check = checkTranscription({ expected: testCase.expected ?? {}, text });

  const parts = testCase.expected?.empty
    ? [Number(check.emptyWhenNothing)]
    : [check.recall, Number(check.signsAndRelations), Number(check.noInvention)];

  const share = parts.reduce((sum, part) => sum + part, 0) / parts.length;

  return createFixedScore({
    conclusion: check.problems.join(" ") || "Every check passed.",
    score: MIN_SCORE + SCORE_RANGE * share,
  });
};

async function generate({
  imageFile,
  model,
  reasoning,
  useFallback,
}: TranscribeMaterialCaseInput & { model: string; reasoning?: Reasoning; useFallback?: boolean }) {
  const photo = await readDatasetImage({ fileName: imageFile, taskId: TASK_ID });

  return transcribeMaterial({
    image: await renderPhotoPage({ bytes: photo, contentType: "image/jpeg" }),
    model,
    reasoning,
    useFallback,
  });
}

export const transcribeMaterialTask: Task<
  TranscribeMaterialCaseInput,
  MaterialTranscription,
  TranscribeMaterialExpected
> = {
  description:
    "Write down a learner's photo or scanned page as it's written, so the plan, lessons and answers can read it",
  generate,
  id: TASK_ID,
  name: "Transcribe material",
  priorities: {
    distribution: "private",
    first: "quality",
    reads: "The goal reading, plan, lessons and answers read it in place of the picture",
    reason: "A misread sign or an invented fact becomes something the learner studies",
    waits: "A learner, when the goal reading waits for a file they just added",
  },
  score: scoreTranscription,
  testCases: TEST_CASES,
};
