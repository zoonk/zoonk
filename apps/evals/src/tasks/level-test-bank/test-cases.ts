import { type TestCase } from "@/lib/types";
import { type GenerateLevelTestBankParams } from "@zoonk/ai/tasks/v2/language/level-test-bank";

type LevelTestBankInput = Omit<
  GenerateLevelTestBankParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

const PT_EN_EXPECTATIONS = `A bank of US English passages and sentences for Brazilian learners: questions, options and translations in Brazilian Portuguese. Levels A1 to C1 clearly increase in difficulty.`;

const EN_PT_EXPECTATIONS = `A bank of Brazilian Portuguese passages and sentences (Brazilian words and forms, "você", not European Portuguese) for US English speakers: questions, options and translations in US English. Levels A1 to C1 clearly increase in difficulty.`;

/**
 * One bank per language pair the courses start with. A bank's only input is its pair, so English
 * and Portuguese, the languages the quality floor reads, have two cases each way: one bank's luck
 * (a single question at the wrong level caps a bank) then moves the average less.
 */
export const TEST_CASES: TestCase<unknown, LevelTestBankInput>[] = [
  {
    expectations: PT_EN_EXPECTATIONS,
    id: "pt-en",
    userInput: { learnerLanguage: "pt", targetLanguage: "en" },
  },
  {
    expectations: PT_EN_EXPECTATIONS,
    id: "pt-en-second",
    userInput: { learnerLanguage: "pt", targetLanguage: "en" },
  },
  {
    expectations: EN_PT_EXPECTATIONS,
    id: "en-pt",
    userInput: { learnerLanguage: "en", targetLanguage: "pt" },
  },
  {
    expectations: EN_PT_EXPECTATIONS,
    id: "en-pt-second",
    userInput: { learnerLanguage: "en", targetLanguage: "pt" },
  },
  {
    expectations: `A bank of Spain Spanish passages and sentences (Spain vocabulary and forms like "vosotros", "piso", "móvil") for US English speakers: questions, options and translations in US English. Levels A1 to C1 clearly increase in difficulty.`,
    id: "en-es",
    userInput: { learnerLanguage: "en", targetLanguage: "es" },
  },
  {
    expectations: `A bank of Spain Spanish passages and sentences (Spain vocabulary and forms like "vosotros", "piso", "móvil") for Brazilian learners: questions, options and translations in Brazilian Portuguese. Portuguese and Spanish are close, so no option can be picked by guessing a cognate. Levels A1 to C1 clearly increase in difficulty.`,
    id: "pt-es",
    userInput: { learnerLanguage: "pt", targetLanguage: "es" },
  },
  {
    expectations: `A bank of US English passages and sentences for Spain Spanish speakers: questions, options and translations in Spain Spanish. Levels A1 to C1 clearly increase in difficulty.`,
    id: "es-en",
    userInput: { learnerLanguage: "es", targetLanguage: "en" },
  },
  {
    expectations: `A bank of French passages and sentences as written and spoken in France (correct accents, "vous" and "tu" used as French speakers would) for US English speakers: questions, options and translations in US English. Levels A1 to C1 clearly increase in difficulty.`,
    id: "en-fr",
    userInput: { learnerLanguage: "en", targetLanguage: "fr" },
  },
  {
    expectations: `A bank of French passages and sentences as written and spoken in France for Brazilian learners: questions, options and translations in Brazilian Portuguese. French and Portuguese share many words, so no option can be picked by guessing a cognate. Levels A1 to C1 clearly increase in difficulty.`,
    id: "pt-fr",
    userInput: { learnerLanguage: "pt", targetLanguage: "fr" },
  },
  {
    expectations: `A bank of German passages and sentences as written and spoken in Germany (correct capitalization of nouns, "Sie" and "du" used as German speakers would) for US English speakers: questions, options and translations in US English. Levels A1 to C1 clearly increase in difficulty.`,
    id: "en-de",
    userInput: { learnerLanguage: "en", targetLanguage: "de" },
  },
  {
    expectations: `A bank of US English passages and sentences for German speakers: questions, options and translations in German as used in Germany. Levels A1 to C1 clearly increase in difficulty.`,
    id: "de-en",
    userInput: { learnerLanguage: "de", targetLanguage: "en" },
  },
];
