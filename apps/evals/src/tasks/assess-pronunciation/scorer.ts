import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type AssessPronunciationSchema } from "@zoonk/ai/tasks/v2/language/assess-pronunciation";
import { scoreFlaggedWords } from "../transcribe-speech/scorer";
import { type PronunciationClipExpected, type PronunciationClipInput } from "./test-cases";

/**
 * Scores the flagged words exactly like the transcription eval, so today's
 * transcript-and-compare path and a model that listens are on one scale. The
 * conclusion also says whether stress errors were named as stress, which only
 * a listening model can do.
 */
export const scorePronunciation: TaskScorer<PronunciationClipExpected> = ({ output, testCase }) => {
  if (!testCase.expected) {
    throw new Error(`Test case ${testCase.id} has no labeled words.`);
  }

  const input = testCase.userInput as PronunciationClipInput;
  const { transcript, words } = JSON.parse(output) as AssessPronunciationSchema;
  const flaggedWords = words.filter((word) => word.status !== "correct");
  const flagged = flaggedWords.map((word) => word.text);

  const stressNamed = flaggedWords
    .filter((word) => word.issue === "stress")
    .map((word) => word.text);

  const { classification, score } = scoreFlaggedWords({
    expected: testCase.expected.flaggedWords,
    flagged,
  });

  const conclusion = `The clip says "${input.spokenText}" (expected "${input.targetText}") and we heard "${transcript}". Expected flagged words ${JSON.stringify(testCase.expected.flaggedWords)}; flagged ${JSON.stringify(flagged)}. Stress errors ${JSON.stringify(testCase.expected.stressWords)}; named as stress ${JSON.stringify(stressNamed)}.`;

  return { ...createFixedScore({ conclusion, score }), classification };
};
