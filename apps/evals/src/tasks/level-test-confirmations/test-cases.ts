import { type TestCase } from "@/lib/types";
import { type GenerateLevelTestConfirmationsParams } from "@zoonk/ai/tasks/language/level-test-confirmations";

type LevelTestConfirmationsInput = Omit<
  GenerateLevelTestConfirmationsParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

export const TEST_CASES: TestCase<unknown, LevelTestConfirmationsInput>[] = [
  {
    expectations: `Two US English reading texts and two voice messages at A1 for Brazilian learners, each with a "select all that apply" question in Brazilian Portuguese about stated facts in very common words (times, prices, places). Two or three options are right; the wrong ones are other values of the same kind the text gives for something else.`,
    id: "pt-en-a1",
    userInput: { learnerLanguage: "pt", level: "A1", targetLanguage: "en" },
  },
  {
    expectations: `Brazilian Portuguese texts at B1 for US English speakers ("você", Brazilian words), with "select all that apply" questions in US English on the main point, reasons and stated opinions, said in the text in other words: a reader who only matches words picks a wrong option.`,
    id: "en-pt-b1",
    userInput: { learnerLanguage: "en", level: "B1", targetLanguage: "pt" },
  },
  {
    expectations: `Mexican Spanish texts at B2 for Brazilian learners, with questions in Brazilian Portuguese whose right options are implied (attitude, purpose, the point of an argument), never stated in one sentence. Portuguese and Spanish are close, so no option can be decided by spotting a cognate.`,
    id: "pt-es-b2",
    userInput: { learnerLanguage: "pt", level: "B2", targetLanguage: "es" },
  },
  {
    expectations:
      "Write two fresh texts and two voice messages for A1. Their scenes, details and facts differ from the previous passages, and every option is decided by its own text.",
    id: "pt-en-a1-retake",
    userInput: {
      learnerLanguage: "pt",
      level: "A1",
      previousPassages: [
        "The bookstore opens at nine today. It closes at six. The cafe opens at eight. It is next to the bookstore.",
        "Hi Bea. Your bus leaves at eight. My bus leaves at ten. I'll meet you at the library at eleven.",
      ],
      targetLanguage: "en",
    },
  },
  {
    expectations: `French texts as written and spoken in France at C1 for US English speakers, with options on implicit meaning, stance, tone or a qualified view: a reader who understands every sentence literally gets at least one wrong. No option asks what an idiom means.`,
    id: "en-fr-c1",
    userInput: { learnerLanguage: "en", level: "C1", targetLanguage: "fr" },
  },
  {
    expectations: `US English texts at C2 for Brazilian learners: demanding essayistic, literary or unscripted spoken texts, with options in Brazilian Portuguese on a fine shade of meaning, an allusion or irony, how an argument is built or an unstated assumption. A careful C1 reader who grasps the stance but misses the nuance gets at least one option wrong. No option asks what a rare word means.`,
    id: "pt-en-c2",
    userInput: { learnerLanguage: "pt", level: "C2", targetLanguage: "en" },
  },
  {
    expectations: `German texts as used in Germany at C2 for US English speakers (correct noun capitalization, "Sie" and "du" used naturally), with options in US English on nuance, allusion, argument structure or an unstated assumption, each decided by the text alone.`,
    id: "en-de-c2",
    userInput: { learnerLanguage: "en", level: "C2", targetLanguage: "de" },
  },
];
