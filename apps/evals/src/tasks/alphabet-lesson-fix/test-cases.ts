import { type TestCase } from "@/lib/types";
import { type FixAlphabetLessonParams } from "@zoonk/ai/tasks/language/alphabet-lesson";
import {
  ALPHABET_LESSONS,
  ALPHABET_SLIPS,
  type AlphabetCheckInput,
} from "../lesson-quality-check/alphabet-lessons";

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

const { cyrillic, hangul } = ALPHABET_LESSONS;

function plant(
  base: AlphabetCheckInput,
  changes: (lesson: AlphabetCheckInput["alphabet"]) => Partial<AlphabetCheckInput["alphabet"]>,
): AlphabetCheckInput {
  return { ...base, alphabet: { ...base.alphabet, ...changes(base.alphabet) } };
}

const rightToLeft = plant(cyrillic, ({ intro }) => ({
  intro: intro.map((screen, index) =>
    index === 0
      ? {
          text: "No russo impresso, leia uma letra por vez, da direita para a esquerda. As letras não se ligam umas às outras.",
          title: "Leia da direita para a esquerda",
        }
      : screen,
  ),
}));

const untaughtLetter = plant(hangul, () => ({
  canDo: "Read and say ㅏ, ㅓ, ㅗ, ㅜ, ㅡ, ㅣ, ㄱ, ㄴ, ㅁ, and ㅎ.",
}));

const hRomanization = plant(cyrillic, ({ letters }) => ({
  letters: letters.map((letter) =>
    letter.symbol === "х" ? { ...letter, readingAid: "h" } : letter,
  ),
}));

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
  {
    expectations: `The rewritten first intro screen says Russian print is read from left to right, one letter at a time; the other intro screen and every letter card stay as they were. In Brazilian Portuguese.`,
    id: "pt-ru-intro-direction",
    userInput: toInput(rightToLeft, [
      {
        problem:
          "The screen says Russian is read from right to left, but Russian is read from left to right. Fix: Say each line is read from left to right.",
        screen: 0,
      },
    ]),
  },
  {
    expectations: `The can-do line lists the ten letters the lesson teaches, with ㅅ and without ㅎ; every letter card stays as it was. In US English.`,
    id: "en-ko-untaught-letter",
    userInput: toInput(untaughtLetter, [
      {
        problem:
          "The can-do line lists ㅎ, which the lesson never teaches, and leaves out ㅅ, which it does. Fix: List ㅅ instead of ㅎ.",
        screen: null,
      },
    ]),
  },
  {
    expectations: `The х card is romanized kh, the standard transliteration that its cue's ха (kha) already shows; its sound cue may stay as it was. In Brazilian Portuguese.`,
    id: "pt-ru-h-romanization",
    userInput: toInput(hRomanization, [
      {
        problem:
          "х is romanized as h, but its standard transliteration is kh, as its cue already shows. Fix: Romanize it as kh.",
        screen: 7,
      },
    ]),
  },
];
