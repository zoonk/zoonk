import { type TestCase } from "@/lib/types";
import { type GenerateSpeakingMockScenarioParams } from "@zoonk/ai/tasks/v2/language/speaking-mock-scenario";

type SpeakingMockScenarioInput = Omit<
  GenerateSpeakingMockScenarioParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

/** The mocks core writes: IELTS and TOEFL, in the five minutes a mock lasts, for each app language. */
export const TEST_CASES: TestCase<unknown, SpeakingMockScenarioInput>[] = [
  {
    expectations: `IELTS Speaking practice mock for a Brazilian candidate at B1. The character is the examiner (role "examinador" or "examinadora"), the objectives are the three parts in order with labels like "Part 1: About you", "Part 2: Cue card", "Part 3: Discussion", and the brief has the Part 1 questions, the full Part 2 cue card (topic and four bullet prompts) and Part 3 questions linked to the cue card topic, run in about 5 minutes. The opening line is the examiner's greeting and first question. Title and situation call it a practice mock in Brazilian Portuguese, shorter than the real test, never an official test. Hints are phrases to keep talking.`,
    id: "pt-en-b1-ielts-speaking",
    userInput: {
      exam: "ielts",
      learnerLanguage: "pt",
      level: "B1",
      minutes: 5,
      targetLanguage: "en",
    },
  },
  {
    expectations: `TOEFL iBT Speaking practice mock for a Brazilian candidate at A2. The character is the examiner (role "examinador" or "examinadora"), the objectives are "Listen and Repeat" then "Take an Interview", and the brief has a campus or academic setting with seven original sentences that start at about 5 words and grow to 14 to 20 with dependent or relative clauses, then a one-sentence interview introduction and four questions going from a brief fact about the candidate to describing an experience, an opinion on a broader issue and a prediction, each said once with about 45 seconds per answer. The opening line greets, gives the Listen and Repeat directions and the setting, and ends with the first sentence. Title and situation, in Brazilian Portuguese, call it a practice mock shorter than the real section, never an official test. Hints help interview answers (a reason, an example, a prediction) at A2 and never ask the examiner to repeat.`,
    id: "pt-en-a2-toefl-speaking",
    userInput: {
      exam: "toefl",
      learnerLanguage: "pt",
      level: "A2",
      minutes: 5,
      targetLanguage: "en",
    },
  },
  {
    expectations: `IELTS Speaking practice mock for a B2 candidate who uses the app in English. The character is the examiner (role "examiner"), the objectives are the three parts in order with labels like "Part 1: About you", "Part 2: Cue card", "Part 3: Discussion", and the brief has 3 or 4 Part 1 questions, the full Part 2 cue card (topic and four bullet prompts) and 3 or 4 Part 3 questions linked to the cue card topic, run in about 5 minutes. The examiner's wording is the exam's usual clear wording, not simplified. The opening line is the examiner's greeting, name and first Part 1 question. Title and situation, in US English, call it a practice mock shorter than the real test, never an official test. Hints are general phrases at B2 to buy time, give an opinion or add an example, never an answer about the topic.`,
    id: "en-en-b2-ielts-speaking",
    userInput: {
      exam: "ielts",
      learnerLanguage: "en",
      level: "B2",
      minutes: 5,
      targetLanguage: "en",
    },
  },
];
