import { readFile } from "node:fs/promises";
import path from "node:path";
import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type WordPronunciationCheck,
  checkWordPronunciation,
} from "@zoonk/ai/tasks/v2/language/check-word-pronunciation";
import {
  LOOK_ALIKE_CLIPS_DIR,
  type LookAlikeClipExpected,
  type LookAlikeClipInput,
  TEST_CASES,
} from "./test-cases";

const RIGHT_SCORE = 10;
const WRONG_SCORE = 2;

async function checkClip({
  clipId,
  englishIpa,
  ipa,
  language,
  model,
  word,
}: LookAlikeClipInput & { model: string }) {
  const audio = new Uint8Array(await readFile(path.join(LOOK_ALIKE_CLIPS_DIR, `${clipId}.mp3`)));

  return checkWordPronunciation({
    audio,
    englishIpa,
    ipa,
    language,
    mediaType: "audio/mpeg",
    model,
    word,
  });
}

function toVerdict({ pronunciation, soundsNative }: WordPronunciationCheck): string {
  if (soundsNative) {
    return "native";
  }

  return pronunciation === "native" ? "closer to english" : pronunciation;
}

const scoreCheck: TaskScorer<LookAlikeClipExpected> = ({ output, testCase }) => {
  if (!testCase.expected) {
    throw new Error(`Test case ${testCase.id} has no label.`);
  }

  const check = JSON.parse(output) as WordPronunciationCheck;
  const verdict = toVerdict(check);
  const { expected } = testCase;
  const isRight = check.soundsNative === (expected.pronunciation === "native");

  return {
    ...createFixedScore({
      conclusion: `Heard /${check.heard}/ and called it ${verdict}; the clip is ${expected.pronunciation}.`,
      score: isRight ? RIGHT_SCORE : WRONG_SCORE,
    }),
    classification: {
      expected: expected.pronunciation,
      predicted: check.soundsNative ? "native" : "english",
    },
  };
};

export const checkWordPronunciationTask: Task<
  LookAlikeClipInput,
  WordPronunciationCheck,
  LookAlikeClipExpected
> = {
  description:
    "Tell from the audio whether a word English spells the same was read with its language's sounds or the English ones, given both in IPA (labeled text-to-speech clips)",
  generate: checkClip,
  id: "check-word-pronunciation",
  name: "Check Word Pronunciation",
  score: scoreCheck,
  testCases: TEST_CASES,
};
