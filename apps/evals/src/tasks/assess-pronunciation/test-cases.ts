import { type TestCase } from "@/lib/types";
import { TEST_CASES as SPEECH_TEST_CASES } from "../transcribe-speech/test-cases";

export type PronunciationClipInput = {
  language: string;
  learnerLanguage: string;
  spokenText: string;
  targetText: string;
};

export type PronunciationClipExpected = { flaggedWords: string[]; stressWords: string[] };

type PronunciationTestCase = TestCase<PronunciationClipExpected, PronunciationClipInput>;

function getLearnerLanguage(language: string): string {
  return language === "en" ? "pt" : "en";
}

export const PRONUNCIATION_CLIP_CASES: PronunciationTestCase[] = [
  {
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
