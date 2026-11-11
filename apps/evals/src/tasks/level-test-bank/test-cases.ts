import { type TestCase } from "@/lib/types";
import { type GenerateLevelTestBankParams } from "@zoonk/ai/tasks/language/level-test-bank";

type LevelTestBankInput = Omit<
  GenerateLevelTestBankParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

const PT_EN_EXPECTATIONS = `A bank of US English passages and sentences for Brazilian learners: questions, options and translations in Brazilian Portuguese. Levels A1 to C1 clearly increase in difficulty.`;

const EN_PT_EXPECTATIONS = `A bank of Brazilian Portuguese passages and sentences (Brazilian words and forms, "você", not European Portuguese) for US English speakers: questions, options and translations in US English. Levels A1 to C1 clearly increase in difficulty.`;

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
    expectations: `A bank of Mexican Spanish passages and sentences (Mexican vocabulary and forms like "ustedes", "departamento", "celular", never "vosotros") for US English speakers: questions, options and translations in US English. Levels A1 to C1 clearly increase in difficulty.`,
    id: "en-es",
    userInput: { learnerLanguage: "en", targetLanguage: "es" },
  },
  {
    expectations: `A bank of Mexican Spanish passages and sentences (Mexican vocabulary and forms like "ustedes", "departamento", "celular", never "vosotros") for Brazilian learners: questions, options and translations in Brazilian Portuguese. Portuguese and Spanish are close, so no option can be picked by guessing a cognate. Levels A1 to C1 clearly increase in difficulty.`,
    id: "pt-es",
    userInput: { learnerLanguage: "pt", targetLanguage: "es" },
  },
  {
    expectations: `A bank of US English passages and sentences for Mexican Spanish speakers: questions, options and translations in Mexican Spanish. Levels A1 to C1 clearly increase in difficulty.`,
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
  {
    expectations:
      "An afternoon departure at three fifteen must be rendered as 15:15 in German answer options. Exactly one option must match the passage, and no answer may depend on an ambiguous localized clock. German options must use a decimal comma for prices, for example 2,50 Dollar rather than $2.50.",
    id: "de-en-afternoon-clock-regression",
    userInput: { learnerLanguage: "de", targetLanguage: "en" },
  },
  {
    expectations:
      "Every answer option must be learner-facing Mexican Spanish or a valid price, never JSON instructions, self-corrections or generation commentary. Each question must have exactly one passage-supported answer.",
    id: "es-en-option-language-regression",
    userInput: { learnerLanguage: "es", targetLanguage: "en" },
  },
  {
    expectations:
      "In a restaurant review, enjoying the food and withholding a recommendation can both be true. Never offer them as competing answers when both are supported. Every question must have exactly one defensible answer.",
    id: "pt-en-review-ambiguity-regression",
    userInput: { learnerLanguage: "pt", targetLanguage: "en" },
  },
  {
    expectations:
      "In a restaurant review, enjoying the food and withholding a recommendation can both be true. Never offer them as competing answers when both are supported. Every question must have exactly one defensible answer.",
    id: "en-pt-review-ambiguity-regression",
    userInput: { learnerLanguage: "en", targetLanguage: "pt" },
  },
  {
    expectations:
      "Modern Standard Arabic in Arabic script with correct agreement and natural names; no dialect mixing. A1 asks one stated fact; A2 combines facts or event order; B1 asks a reason or main point; B2 requires implied attitude or purpose; C1 requires implicit stance, register or a qualified view. Questions, options and translations must be US English. Time and currency conversions must preserve value and exactly one answer must be defensible.",
    id: "en-ar-fable",
    userInput: { learnerLanguage: "en", targetLanguage: "ar" },
  },
  {
    expectations:
      "Modern Standard Arabic in Arabic script for Brazilian learners. Questions, options and translations must be Brazilian Portuguese with localized decimal and thousands separators. A1 is concrete, A2 combines details, B1 tests reasons, B2 tests implications, C1 tests qualified stance or tone. Exactly one passage-supported key; no target-language decoding from cognates or leaked generation instructions.",
    id: "pt-ar-fable",
    userInput: { learnerLanguage: "pt", targetLanguage: "ar" },
  },
  {
    expectations:
      "German as used in Germany for learners in France. Questions, options and translations must be French as used in France. Preserve afternoon times in 24-hour notation and German noun capitalization and appropriate Sie/du. A1 stated facts, A2 sequence or combined facts, B1 reason or main point, B2 implications, C1 qualified stance or tone. Restaurant enjoyment and reservations must not become two simultaneously defensible options.",
    id: "fr-de-fable",
    userInput: { learnerLanguage: "fr", targetLanguage: "de" },
  },
  {
    expectations:
      "US English passages for Japanese speakers. Questions, options and translations must be natural Japanese in Japanese script. Preserve a.m./p.m. distinctions, monetary amounts and names. A1 concrete facts, A2 sequence or two facts, B1 reasons or main points, B2 implied attitude or purpose, C1 implicit meaning or register. Each question has exactly one defensible key, including reviews with mixed opinions; no instructions or self-corrections in options.",
    id: "ja-en-fable",
    userInput: { learnerLanguage: "ja", targetLanguage: "en" },
  },
  {
    expectations:
      "Brazilian Portuguese passages for US English learners. US English options must use US numeric separators: a rent of R$ 1.600 in the Portuguese passage is R$ 1,600 in English, never R$ 1.600. Preserve the amount, use exactly one supported key and retain the A1 to C1 progression.",
    id: "en-pt-price-localization-regression",
    userInput: { learnerLanguage: "en", targetLanguage: "pt" },
  },
  {
    expectations:
      "German workplace passages for French learners. A writer can find management's reasons convincing while personally disliking the change. Do not offer being convinced by the arguments and accepting reluctantly as mutually exclusive answers. Make every distractor contradict the passage, rather than merely omit part of the writer's mixed attitude. Keep the A1 to C1 progression.",
    id: "fr-de-workplace-ambiguity-regression",
    userInput: { learnerLanguage: "fr", targetLanguage: "de" },
  },
];
