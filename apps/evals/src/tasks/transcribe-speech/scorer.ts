import { createFixedScore } from "@/lib/score";
import { type ClassificationOutcome, type TaskScorer } from "@/lib/types";
import { matchSpokenAnswer } from "@zoonk/core/library/language/spoken-answer-match";
import { type SpeechClipExpected, type SpeechClipInput } from "./test-cases";

const WORDS_MATCH_SCORE = 10;
const VERDICT_ONLY_SCORE = 7;
const WRONG_VERDICT_SCORE = 2;

function toLabel(isCorrect: boolean): string {
  return isCorrect ? "said right" : "mistake";
}

function getScore({
  verdictMatches,
  wordsMatch,
}: {
  verdictMatches: boolean;
  wordsMatch: boolean;
}) {
  if (wordsMatch) {
    return WORDS_MATCH_SCORE;
  }

  return verdictMatches ? VERDICT_ONLY_SCORE : WRONG_VERDICT_SCORE;
}

function sameWords(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(left.toSorted()) === JSON.stringify(right.toSorted());
}

/**
 * Scores the words a grader flagged in a clip against its labels. Hiding a
 * mistake, or flagging a sentence said right, decides most of the score and
 * the exact flagged words the rest, so every speech eval grades the same way.
 */
export function scoreFlaggedWords({
  expected,
  flagged,
}: {
  expected: readonly string[];
  flagged: readonly string[];
}): { classification: ClassificationOutcome; score: number } {
  const expectedCorrect = expected.length === 0;
  const predictedCorrect = flagged.length === 0;

  return {
    classification: { expected: toLabel(expectedCorrect), predicted: toLabel(predictedCorrect) },
    score: getScore({
      verdictMatches: expectedCorrect === predictedCorrect,
      wordsMatch: sameWords(flagged, expected),
    }),
  };
}

/**
 * Scores a transcript by what the product does with it: compare it with the
 * expected sentence and flag words. A model that "hears" the right word when
 * the learner said another one hides the mistake.
 */
export const scoreSpeechTranscript: TaskScorer<SpeechClipExpected> = ({ output, testCase }) => {
  if (!testCase.expected) {
    throw new Error(`Test case ${testCase.id} has no labeled words.`);
  }

  const input = testCase.userInput as SpeechClipInput;
  const { text } = JSON.parse(output) as { text: string };

  const match = matchSpokenAnswer({
    expected: input.targetText,
    heard: text,
    language: input.language,
  });

  const flagged = match.words.filter((word) => word.status !== "correct").map((word) => word.text);

  const { classification, score } = scoreFlaggedWords({
    expected: testCase.expected.flaggedWords,
    flagged,
  });

  const conclusion = `The clip says "${input.spokenText}" and we heard "${text}". Expected flagged words ${JSON.stringify(testCase.expected.flaggedWords)}; flagged ${JSON.stringify(flagged)}.`;

  return { ...createFixedScore({ conclusion, score }), classification };
};
