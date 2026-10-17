import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { getIpaSimilarity } from "@zoonk/ai/tasks/v2/language/ipa-similarity";
import { type WordIpa } from "@zoonk/ai/tasks/v2/language/word-ipa";
import { type WordIpaExpected } from "./test-cases";

const RIGHT_SCORE = 10;
/** A missed look-alike gets no IPA and may be read the English way; a false one only costs a listen. */
const MISSED_SCORE = 2;
const FALSE_ALARM_SCORE = 6;
const WRONG_SOUNDS_SCORE = 2;
/** A dropped ending ("ˈtʃĩ" for "ˈtʃĩmi") or one English vowel too many falls below it. */
const MIN_SIMILARITY = 0.75;

function toLabel(isLookAlike: boolean): string {
  return isLookAlike ? "look-alike" : "own word";
}

/** Whether the IPA is close to how the language says the word, and closer to it than to English. */
function hasRightSounds({ expected, ipa }: { expected: WordIpaExpected; ipa: string }): boolean {
  if (!expected.native) {
    return true;
  }

  const nativeSimilarity = getIpaSimilarity(ipa, expected.native);

  const closerToNative =
    !expected.english || nativeSimilarity > getIpaSimilarity(ipa, expected.english);

  return nativeSimilarity >= MIN_SIMILARITY && closerToNative;
}

function getScore({
  expected,
  predicted,
  soundsRight,
}: {
  expected: boolean;
  predicted: boolean;
  soundsRight: boolean;
}): number {
  if (!soundsRight) {
    return WRONG_SOUNDS_SCORE;
  }

  if (expected === predicted) {
    return RIGHT_SCORE;
  }

  return expected ? MISSED_SCORE : FALSE_ALARM_SCORE;
}

/**
 * Scores what the voice would get: whether the word was taken for an English spelling, which
 * decides if it gets its IPA and a listen, and, where the case knows both pronunciations, whether
 * the IPA has the language's sounds.
 */
export const scoreWordIpa: TaskScorer<WordIpaExpected> = ({ output, testCase }) => {
  if (!testCase.expected) {
    throw new Error(`Test case ${testCase.id} has no expected answer.`);
  }

  const { expected } = testCase;
  const result = JSON.parse(output) as WordIpa;
  const ipa = result.ipa ?? "";
  const predicted = result.englishIpa !== null;
  const soundsRight = hasRightSounds({ expected, ipa });

  const reference = expected.native ? ` (expected /${expected.native}/)` : "";
  const conclusion = `Wrote /${ipa}/${reference} and English /${result.englishIpa ?? "none"}/; the word is ${toLabel(expected.isLookAlike)}.`;

  return {
    ...createFixedScore({
      conclusion,
      score: getScore({ expected: expected.isLookAlike, predicted, soundsRight }),
    }),
    classification: { expected: toLabel(expected.isLookAlike), predicted: toLabel(predicted) },
  };
};
