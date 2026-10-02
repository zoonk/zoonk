import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./alphabet-lesson.prompt.md";

/**
 * Written once per script and learner language, and shared by every learner of that pair. In the
 * `alphabet-lesson` eval (hiragana and Hangul for English speakers, Cyrillic and Arabic for
 * Portuguese speakers, 27 Sep 2026) Luna scored 8.87 (9.31 English, 8.42 Portuguese) at 17.8s p50
 * and $1.50 per 1k runs, and Sol 8.68 at $20.68. Both voiced Russian consonants as syllables
 * without saying so (7.38 on that case); with the cue now saying so, Luna's Cyrillic case scored
 * 8.77 and its overall 9.21 (9.31 English, 9.12 Portuguese).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["openai/gpt-6-sol"] as const;

const MIN_INTRO = 1;
const MAX_INTRO = 2;
const MIN_LETTERS = 6;
const MAX_LETTERS = 10;
const MIN_SUMMARY = 2;
const MAX_SUMMARY = 3;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the script and what the lesson covers come before its screens. */
const letterSchema = z.object({
  symbol: z.string(),
  readingAid: z.string(),
  pronunciation: z.string(),
  audioText: z.string(),
  forms: z.array(z.object({ label: z.string(), symbol: z.string() })),
});

const schema = z.object({
  script: z.string(),
  title: z.string(),
  description: z.string(),
  canDo: z.string(),
  intro: z
    .array(z.object({ title: z.string(), text: z.string() }))
    .min(MIN_INTRO)
    .max(MAX_INTRO),
  letters: z.array(letterSchema).min(MIN_LETTERS).max(MAX_LETTERS),
  summary: z.array(z.string()).min(MIN_SUMMARY).max(MAX_SUMMARY),
});
/* oxlint-enable eslint/sort-keys */

export type AlphabetLessonContent = z.infer<typeof schema>;

export type GenerateAlphabetLessonParams = {
  targetLanguage: string;
  learnerLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * Writes the first alphabet lesson for a language whose script isn't Latin: a short intro on how
 * the script is read, 6 to 10 letters with romanization, a sound cue for the learner's language,
 * the text a voice says and real positional forms, and a summary. Code turns it into alphabet
 * cards and recognition checks, and the lesson opens a new learner's first session.
 */
export async function generateAlphabetLesson(params: GenerateAlphabetLessonParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;

  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  const userPrompt = `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "alphabet-lesson",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
