import "server-only";
import { usesNonLatinScript } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./language-lesson.prompt.md";

/**
 * Written once per language pair and shared by every learner of that pair, so
 * quality wins over cost. In the per-pair eval (5 cases: pt-en at A2 and B1,
 * en-pt, en-es and es-en, Sep 2026) Sol scored 8.16 at 47s p50 and about
 * $0.04 a lesson; Gemini 3.8 Flash scored 7.40 at 9s and $0.01, with more
 * false pronunciation rules and wrong options that were also right. GPT-6.1
 * Sol replaced GPT-6 Sol (7 Oct 2026, 3 cases, same prompt and hour): 8.83
 * against 7.30 at 48s against 50s p50 and $0.028 against $0.042 a lesson; GPT-6
 * Sol stated a false grammar rule in all three lessons, 6.1 in none.
 */
const defaultModel = "openai/gpt-6.1-sol";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

const MIN_WORDS = 3;
const MAX_WORDS = 5;
const WORD_DISTRACTORS = 3;
const MIN_SENTENCES = 3;
const MAX_SENTENCES = 4;
const MIN_SENTENCE_DISTRACTORS = 2;
const MAX_SENTENCE_DISTRACTORS = 3;
const MIN_TIP_EXAMPLES = 2;
const MAX_TIP_EXAMPLES = 3;
const MAX_PRACTICE = 2;
const MIN_PRACTICE_DISTRACTORS = 2;
const MAX_PRACTICE_DISTRACTORS = 3;
const MAX_WRITING_ANSWERS = 4;
const MAX_KEY_POINTS = 3;
const MIN_SUMMARY_LINES = 2;
const MAX_SUMMARY_LINES = 4;

const sentenceDistractors = z
  .array(z.string())
  .min(MIN_SENTENCE_DISTRACTORS)
  .max(MAX_SENTENCE_DISTRACTORS);

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: words come before the sentences that use them, and the tip before its practice. */
const schema = z.object({
  words: z
    .array(
      z.object({
        word: z.string(),
        translation: z.string(),
        pronunciation: z.string(),
        romanization: z.string().nullable(),
        tip: z.string().nullable(),
        note: z.string().nullable(),
        distractors: z.array(z.string()).length(WORD_DISTRACTORS),
      }),
    )
    .min(MIN_WORDS)
    .max(MAX_WORDS),
  sentences: z
    .array(
      z.object({
        sentence: z.string(),
        translation: z.string(),
        explanation: z.string(),
        romanization: z.string().nullable(),
        distractors: sentenceDistractors,
        translationDistractors: sentenceDistractors,
        speakingPrompt: z.string().nullable(),
      }),
    )
    .min(MIN_SENTENCES)
    .max(MAX_SENTENCES),
  tip: z.object({
    title: z.string(),
    text: z.string(),
    examples: z
      .array(z.object({ sentence: z.string(), translation: z.string() }))
      .min(MIN_TIP_EXAMPLES)
      .max(MAX_TIP_EXAMPLES),
  }),
  practice: z
    .array(
      z.object({
        question: z.string().nullable(),
        template: z.string(),
        answer: z.string(),
        distractors: z
          .array(z.string())
          .min(MIN_PRACTICE_DISTRACTORS)
          .max(MAX_PRACTICE_DISTRACTORS),
        feedback: z.string(),
      }),
    )
    .min(1)
    .max(MAX_PRACTICE),
  writing: z.object({
    prompt: z.string(),
    answers: z.array(z.string()).min(1).max(MAX_WRITING_ANSWERS),
    keyPoints: z.array(z.string()).min(1).max(MAX_KEY_POINTS),
  }),
  summary: z.array(z.string()).min(MIN_SUMMARY_LINES).max(MAX_SUMMARY_LINES),
});
/* oxlint-enable eslint/sort-keys */

export type LanguageLessonContent = z.infer<typeof schema>;

export type LanguageLessonParams = {
  /** The learner's language: translations, explanations and tips are written in it. */
  learnerLanguage: string;
  targetLanguage: string;
  /** A CEFR level ("A2") or band ("A1–A2"). */
  level: string;
  unitTitle: string;
  unitCanDos: string[];
  lessonTitle: string;
  lessonDescription: string;
  lessonCanDo?: string | null;
  /** Words taught earlier in the course: reused in sentences, never taught again. */
  knownWords?: string[];
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatList(values: readonly string[] | undefined): string {
  return values && values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "none";
}

function buildUserPrompt(params: LanguageLessonParams): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}
${formatLocalContext(params.targetLanguage)}
    NEEDS_ROMANIZATION: ${usesNonLatinScript(params.targetLanguage) ? "yes" : "no"}
    LEVEL: ${params.level}
    UNIT: ${params.unitTitle}
    UNIT_CAN_DOS:
${formatList(params.unitCanDos)}
    LESSON_TITLE: ${params.lessonTitle}
    LESSON_DESCRIPTION: ${params.lessonDescription}
    LESSON_CAN_DO: ${params.lessonCanDo ?? "none"}
    KNOWN_WORDS:
${formatList(params.knownWords)}
  `;
}

/**
 * Writes one language lesson for a language pair: the new words with their
 * meanings, respellings and tips for speakers of the learner's language, the
 * sentences, a pattern tip with practice, one sentence to write and the
 * summary. Target-language words and sentences are stored once per target
 * language and reused by every pair; everything else belongs to the pair.
 */
export async function generateLanguageLesson(params: LanguageLessonParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

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
    task: "language-lesson",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
