import { type TestCase } from "@/lib/types";
import { TEST_CASES as SPEECH_TEST_CASES } from "../transcribe-speech/test-cases";

/**
 * A labeled recording for word-by-word pronunciation checks: what the learner
 * was asked to say, what the clip says, and the learner's own language. Labels
 * follow the transcription eval's rule: a word is flagged only when a native
 * listener would understand another word or form, or couldn't tell which word
 * it was, so the same slip can be fine in one sentence and wrong in another
 * ("desert" for "dessert"). Every clip is text-to-speech (see
 * scripts/generate-speech-clips.ts): wrong words come from a wrong text, and
 * sound or stress slips from a respelled one ("medíco" read aloud stresses the
 * second syllable). They test clear slips, not a real accent.
 */
export type PronunciationClipInput = {
  language: string;
  learnerLanguage: string;
  spokenText: string;
  targetText: string;
};

/** The words to flag, and which of them are stress errors. */
export type PronunciationClipExpected = { flaggedWords: string[]; stressWords: string[] };

type PronunciationTestCase = TestCase<PronunciationClipExpected, PronunciationClipInput>;

/** English learners here speak Portuguese; Portuguese and Spanish learners speak English. */
function getLearnerLanguage(language: string): string {
  return language === "en" ? "pt" : "en";
}

/** Clips only this eval uses: sound and stress slips a transcript may hide. */
export const PRONUNCIATION_CLIP_CASES: PronunciationTestCase[] = [
  {
    // Nobody orders a desert, so a listener still hears "dessert".
    expected: { flaggedWords: [], stressWords: [] },
    id: "en-dessert-desert",
    userInput: {
      language: "en",
      learnerLanguage: "pt",
      spokenText: "Can we order desert?",
      targetText: "Can we order dessert?",
    },
  },
  {
    // Odd stress, but the word is still clear.
    expected: { flaggedWords: [], stressWords: [] },
    id: "en-comfortable-stress",
    userInput: {
      language: "en",
      learnerLanguage: "pt",
      spokenText: "The bed is very come-for-table.",
      targetText: "The bed is very comfortable.",
    },
  },
  {
    // "I want to live now" makes sense too.
    expected: { flaggedWords: ["leave"], stressWords: [] },
    id: "en-leave-live",
    userInput: {
      language: "en",
      learnerLanguage: "pt",
      spokenText: "I want to live now.",
      targetText: "I want to leave now.",
    },
  },
  {
    // An extra vowel at the end is an accent: "bookie a room" can only mean "book".
    expected: { flaggedWords: [], stressWords: [] },
    id: "en-book-booky",
    userInput: {
      language: "en",
      learnerLanguage: "pt",
      spokenText: "I need to booky a room.",
      targetText: "I need to book a room.",
    },
  },
  {
    expected: { flaggedWords: [], stressWords: [] },
    id: "pt-medico-correct",
    userInput: {
      language: "pt",
      learnerLanguage: "en",
      spokenText: "O médico chegou cedo.",
      targetText: "O médico chegou cedo.",
    },
  },
  {
    // Odd stress, but only "médico" makes sense here.
    expected: { flaggedWords: [], stressWords: [] },
    id: "pt-medico-stress",
    userInput: {
      language: "pt",
      learnerLanguage: "en",
      spokenText: "O medíco chegou cedo.",
      targetText: "O médico chegou cedo.",
    },
  },
  {
    // Odd stress, but the word is still clear.
    expected: { flaggedWords: [], stressWords: [] },
    id: "es-telefono-stress",
    userInput: {
      language: "es",
      learnerLanguage: "en",
      spokenText: "¿Dónde está el telefóno?",
      targetText: "¿Dónde está el teléfono?",
    },
  },
  {
    // The same slip as "Can we order desert?", but here a desert fits the sentence.
    expected: { flaggedWords: ["dessert"], stressWords: ["dessert"] },
    id: "en-dessert-desert-fits",
    userInput: {
      language: "en",
      learnerLanguage: "pt",
      spokenText: "The desert is hot.",
      targetText: "The dessert is hot.",
    },
  },
  {
    // Pronunciation reviews say one word alone, with no sentence to help: "sink" is another word.
    expected: { flaggedWords: ["think"], stressWords: [] },
    id: "en-think-alone",
    userInput: { language: "en", learnerLanguage: "pt", spokenText: "sink", targetText: "think" },
  },
  {
    expected: { flaggedWords: ["rent"], stressWords: [] },
    id: "en-rent-alone",
    userInput: { language: "en", learnerLanguage: "pt", spokenText: "hent", targetText: "rent" },
  },
  {
    // Odd stress, but the word is still clear on its own.
    expected: { flaggedWords: [], stressWords: [] },
    id: "es-telefono-alone",
    userInput: {
      language: "es",
      learnerLanguage: "en",
      spokenText: "telefóno",
      targetText: "teléfono",
    },
  },
];

export const TEST_CASES: PronunciationTestCase[] = [
  ...SPEECH_TEST_CASES.map((testCase) => ({
    expected: { flaggedWords: testCase.expected?.flaggedWords ?? [], stressWords: [] },
    id: testCase.id,
    userInput: {
      ...testCase.userInput,
      learnerLanguage: getLearnerLanguage(testCase.userInput.language),
    },
  })),
  ...PRONUNCIATION_CLIP_CASES,
];
