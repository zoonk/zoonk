import { type TestCase } from "@/lib/types";
import { type FixAlphabetLessonParams } from "@zoonk/ai/tasks/language/alphabet-lesson";
import { ALPHABET_SLIPS, type AlphabetCheckInput } from "../lesson-quality-check/alphabet-lessons";

export type AlphabetLessonFixInput = Omit<
  FixAlphabetLessonParams,
  "analytics" | "model" | "reasoning" | "serviceTier" | "useFallback"
>;

function toInput(
  { alphabet, learnerLanguage, targetLanguage }: AlphabetCheckInput,
  problems: FixAlphabetLessonParams["problems"],
): AlphabetLessonFixInput {
  return { learnerLanguage, lesson: alphabet, problems, targetLanguage };
}

export const TEST_CASES: TestCase<unknown, AlphabetLessonFixInput>[] = [
  {
    expectations: `The rewritten х card drops the silent h of "hora" and describes /x/ as a rough sound made at the back of the mouth, compared with the strong r Brazilians say in "rato" or "carro" in accents such as Rio's, or said to be absent from Portuguese with what differs; it still shows ха (kha). In Brazilian Portuguese.`,
    id: "pt-ru-silent-h",
    userInput: toInput(ALPHABET_SLIPS.silentH, [
      {
        problem:
          'The cue for х places its sound "mais atrás que o h de “hora”", but the h of "hora" is silent in Portuguese, so it gives the learner no sound to start from. Fix: Describe /x/ as a rough sound at the back of the mouth and compare it with a Portuguese sound that has it, such as the strong r of "rato" in a Rio accent, still showing ха (kha).',
        screen: 7,
      },
    ]),
  },
  {
    expectations: `The rewritten ㅡ card describes a high back unrounded vowel: the oo of "food" (not the lax vowel of "book") said with spread, unrounded lips, and it still shows 으 (eu). In US English.`,
    id: "en-ko-book-vowel",
    userInput: toInput(ALPHABET_SLIPS.bookVowel, [
      {
        problem:
          'The cue compares ㅡ with the oo of "book", a lower, lax vowel, while ㅡ is the high back unrounded vowel /ɯ/. Fix: Compare it with the oo of "food" said with the lips spread instead of rounded, still showing 으 (eu).',
        screen: 6,
      },
    ]),
  },
];
