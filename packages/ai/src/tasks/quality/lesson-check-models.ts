import { pickReviewers } from "../../_utils/model-family";

/**
 * On the 26 shared lessons Opus wrote on 8 Nov 2026, two blind judges confirmed 6 errors. Astra
 * found all 6 with no false flag at $0.037 a review on flex, Sol 4 and Opus 2. Gemini 4 Argon found
 * none and flagged a correct legal citation as wrong because the lesson plan had it wrong, and
 * Gemini 3.8 Flash, the reviewer before, passed 24 of those lessons. On those 6 errors among 18
 * cases (11 Nov 2026), Fable caught 2 and Gemini 4 Carbon 5, but Carbon also flagged a clean
 * lesson. So an Opus-written lesson has no fallback outside OpenAI: no other evaluated reviewer
 * helped.
 */
const WRITTEN_REVIEWERS = [
  "openai/gpt-6-astra",
  "openai/gpt-6.1-sol",
  "anthropic/claude-opus-5.5",
] as const;

/** Luna writes alphabet lessons; Sonnet 5.5 blocked all 20 planted mistakes in the review eval (9 Oct 2026). */
const ALPHABET_REVIEWERS = [
  "anthropic/claude-sonnet-5.5",
  "google/gemini-3.8-flash",
  "openai/gpt-6.1-sol",
] as const;

/**
 * On 9 slips learners met (#2506, #2414) and 4 clean lessons, 3 runs each (11 Nov 2026), Sonnet 5.5
 * caught 26 of 27 slips on their screen and blocked no clean lesson, at $18 per 1k reviews; Gemini
 * 3.8 Flash caught 24, blocked 2 and costs about the same, with a 76 s p95. Haiku 5.5 and Gemini
 * 3.5 Flash-Lite missed a third of the slips. Luna, Terra and Sol blocked 9 to 12 of the 12 clean
 * runs over respelling conventions, so no OpenAI model reviews these lessons.
 */
const LANGUAGE_REVIEWERS = ["anthropic/claude-sonnet-5.5", "google/gemini-3.8-flash"] as const;

const REVIEWERS = {
  alphabet: ALPHABET_REVIEWERS,
  language: LANGUAGE_REVIEWERS,
  written: WRITTEN_REVIEWERS,
} as const;

export function getLessonCheckModels({
  kind = "written",
  writerModel,
  writerModels,
}: {
  kind?: keyof typeof REVIEWERS;
  writerModel?: string;
  writerModels?: readonly string[];
}): { fallbackModels: string[]; model: string } {
  return pickReviewers({ reviewers: REVIEWERS[kind], writerModel, writerModels });
}
