import { type TestCase } from "@/lib/types";

export type SpeechClipInput = { language: string; spokenText: string; targetText: string };

export type SpeechClipExpected = { flaggedWords: string[] };

export const TEST_CASES: TestCase<SpeechClipExpected, SpeechClipInput>[] = [
  {
    expected: { flaggedWords: [] },
    id: "en-rent-correct",
    userInput: {
      language: "en",
      spokenText: "How much is the rent?",
      targetText: "How much is the rent?",
    },
  },
  {
    expected: { flaggedWords: ["rent?"] },
    id: "en-rent-hent",
    userInput: {
      language: "en",
      spokenText: "How much is the hent?",
      targetText: "How much is the rent?",
    },
  },
  {
    expected: { flaggedWords: ["I've", "lived"] },
    id: "en-lived-live",
    userInput: {
      language: "en",
      spokenText: "I live here since 2020.",
      targetText: "I've lived here since 2020.",
    },
  },
  {
    expected: { flaggedWords: [] },
    id: "en-available-correct",
    userInput: {
      language: "en",
      spokenText: "Is the apartment still available?",
      targetText: "Is the apartment still available?",
    },
  },
  {
    expected: { flaggedWords: ["the"] },
    id: "en-missing-the",
    userInput: {
      language: "en",
      spokenText: "Can I see apartment on Saturday?",
      targetText: "Can I see the apartment on Saturday?",
    },
  },
  {
    expected: { flaggedWords: ["ship"] },
    id: "en-ship-sheep",
    userInput: {
      language: "en",
      spokenText: "The sheep is very big",
      targetText: "The ship is very big",
    },
  },
  {
    expected: { flaggedWords: [] },
    id: "en-think-sink",
    userInput: {
      language: "en",
      spokenText: "I sink it's cheap",
      targetText: "I think it's cheap",
    },
  },
  {
    expected: { flaggedWords: [] },
    id: "pt-disponivel-correct",
    userInput: {
      language: "pt",
      spokenText: "O apartamento ainda está disponível?",
      targetText: "O apartamento ainda está disponível?",
    },
  },
  {
    expected: { flaggedWords: ["está"] },
    id: "pt-estar",
    userInput: {
      language: "pt",
      spokenText: "O apartamento ainda estar disponível?",
      targetText: "O apartamento ainda está disponível?",
    },
  },
  {
    expected: { flaggedWords: [] },
    id: "pt-mais-mas",
    userInput: {
      language: "pt",
      spokenText: "Eu quero mas café",
      targetText: "Eu quero mais café",
    },
  },
  {
    expected: { flaggedWords: [] },
    id: "es-alquiler-correct",
    userInput: {
      language: "es",
      spokenText: "¿Cuánto cuesta el alquiler?",
      targetText: "¿Cuánto cuesta el alquiler?",
    },
  },
  {
    expected: { flaggedWords: ["perro"] },
    id: "es-perro-pero",
    userInput: { language: "es", spokenText: "Tengo un pero", targetText: "Tengo un perro" },
  },
  {
    expected: { flaggedWords: ["el"] },
    id: "es-missing-el",
    userInput: {
      language: "es",
      spokenText: "Quiero ver piso mañana",
      targetText: "Quiero ver el piso mañana",
    },
  },
  {
    expected: { flaggedWords: [] },
    id: "zh-library-correct",
    userInput: {
      language: "zh",
      spokenText: "请问，图书馆在哪里？",
      targetText: "请问，图书馆在哪里？",
    },
  },
  {
    expected: { flaggedWords: ["请问，图书馆在哪里？"] },
    id: "zh-library-station",
    userInput: {
      language: "zh",
      spokenText: "请问，地铁站在哪里？",
      targetText: "请问，图书馆在哪里？",
    },
  },
];
