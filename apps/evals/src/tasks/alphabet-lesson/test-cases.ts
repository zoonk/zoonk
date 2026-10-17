import { type TestCase } from "@/lib/types";
import { type GenerateAlphabetLessonParams } from "@zoonk/ai/tasks/v2/language/alphabet-lesson";

type AlphabetLessonInput = Omit<
  GenerateAlphabetLessonParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

/** Whether the script joins its letters, so the letters must carry their positional forms. */
export type AlphabetLessonExpected = { joined: boolean };

/**
 * One case per kind of script: a syllabary, a featural alphabet that builds blocks, an alphabet
 * with false friends and a connected script with joining forms, for English and Portuguese
 * speakers.
 */
export const TEST_CASES: TestCase<AlphabetLessonExpected, AlphabetLessonInput>[] = [
  {
    expectations: `The first hiragana for a US English speaker: the five vowels and the K row (か, き, く, け, こ), standard Hepburn romanization, vowels described as short and pure, no forms. The intro says hiragana stands for syllables, read left to right here. In US English.`,
    expected: { joined: false },
    id: "en-ja-hiragana",
    userInput: { learnerLanguage: "en", targetLanguage: "ja" },
  },
  {
    expectations: `The first Cyrillic for a Brazilian Portuguese speaker learning Russian: letters that look Latin but sound different (such as В, Н, Р, С, У) and a few new shapes, with sound cues compared to Portuguese sounds and false friends named. No forms. In Brazilian Portuguese.`,
    expected: { joined: false },
    id: "pt-ru-cyrillic",
    userInput: { learnerLanguage: "pt", targetLanguage: "ru" },
  },
  {
    expectations: `The first Arabic letters for a Brazilian Portuguese speaker: a few common letters (such as ب, ت, ن, ي, ا) with their real joining forms labeled in Portuguese, the intro explaining right-to-left reading and joining, the sound separate from the letter's name, and ا without invented medial forms. In Brazilian Portuguese.`,
    expected: { joined: true },
    id: "pt-ar-letters",
    userInput: { learnerLanguage: "pt", targetLanguage: "ar" },
  },
  {
    expectations: `The first Hangul for a US English speaker: a few basic vowels and simple consonants that build real blocks, the intro explaining syllable blocks, plain stops described as unaspirated rather than as English b or d, Revised Romanization, no forms. In US English.`,
    expected: { joined: false },
    id: "en-ko-hangul",
    userInput: { learnerLanguage: "en", targetLanguage: "ko" },
  },
];
