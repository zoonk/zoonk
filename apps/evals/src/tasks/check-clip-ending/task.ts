import { readFile } from "node:fs/promises";
import path from "node:path";
import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type Reasoning } from "@zoonk/ai/provider-options";
import { type ClipEndingCheck, checkClipEnding } from "@zoonk/ai/tasks/audio/check-clip-ending";
import {
  CLIP_ENDING_CLIPS_DIR,
  type ClipEndingExpected,
  type ClipEndingInput,
  TEST_CASES,
} from "./test-cases";

const RIGHT_SCORE = 10;
const WRONG_SCORE = 2;

async function checkClip({
  clipId,
  language,
  model,
  reasoning,
  text,
}: ClipEndingInput & { model: string; reasoning?: Reasoning }) {
  const audio = new Uint8Array(await readFile(path.join(CLIP_ENDING_CLIPS_DIR, `${clipId}.mp3`)));

  return checkClipEnding({
    audio,
    language,
    mediaType: "audio/mpeg",
    model,
    reasoning,
    text,
    useFallback: false,
  });
}

function toLabel(added: ClipEndingCheck["added"]): string {
  return added === "none" ? "clean" : "added";
}

const scoreCheck: TaskScorer<ClipEndingExpected> = ({ output, testCase }) => {
  if (!testCase.expected) {
    throw new Error(`Test case ${testCase.id} has no label.`);
  }

  const check = JSON.parse(output) as ClipEndingCheck;
  const { expected } = testCase;
  const isRight = toLabel(check.added) === toLabel(expected.added);

  return {
    ...createFixedScore({
      conclusion: `Heard "${check.heard}" and called it ${check.added}; the clip says "${expected.heard}" (${expected.added}).`,
      score: isRight ? RIGHT_SCORE : WRONG_SCORE,
    }),
    classification: { expected: toLabel(expected.added), predicted: toLabel(check.added) },
  };
};

export const checkClipEndingTask: Task<ClipEndingInput, ClipEndingCheck, ClipEndingExpected> = {
  description:
    "Hear whether a text-to-speech clip says anything before or after its text, such as a voice finishing a phrase left open (labeled clips)",
  generate: checkClip,
  id: "check-clip-ending",
  name: "Check clip ending",
  priorities: {
    distribution: "shared",
    first: "cost",
    reads: "Code voices a clip again when it says more than its text",
    reason:
      "A yes or no that code checks on every new word or phrase clip; a learner can wait on it",
    waits: "Mostly prepared ahead; a learner tapping a new phrase waits on it",
  },
  score: scoreCheck,
  testCases: TEST_CASES,
};
