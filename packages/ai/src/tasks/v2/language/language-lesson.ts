import "server-only";
import { isSameLanguage, usesNonLatinScript } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import respellingForEnglish from "./language-lesson-respelling-en.prompt.md";
import respellingForSpanish from "./language-lesson-respelling-es.prompt.md";
import respellingForPortuguese from "./language-lesson-respelling-pt.prompt.md";
import basePrompt from "./language-lesson.prompt.md";

/**
 * Written once per pair and shared, so quality wins: GPT-6.1 Sol scored 8.83 against GPT-6 Sol's
 * 7.30, which stated a false grammar rule in every lesson (7 Oct 2026).
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

const RESPELLING_RULES: Partial<Record<string, string>> = {
  en: respellingForEnglish,
  es: respellingForSpanish,
  pt: respellingForPortuguese,
};

/**
 * A learner who reads the app in the language they're learning gets definitions instead of
 * translations, and nothing compared with another language.
 */
function getSystemPrompt({
  learnerLanguage,
  targetLanguage,
}: Pick<LanguageLessonParams, "learnerLanguage" | "targetLanguage">): string {
  const respelling = RESPELLING_RULES[learnerLanguage] ?? "";
  const sameLanguage = isSameLanguage({ learnerLanguage, targetLanguage });

  return selectPromptVariants({
    template: basePrompt,
    variants: { bilingual: !sameLanguage, sameLanguage },
  }).replace("{{READER_RESPELLING}}\n", () => respelling);
}

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
 * Target-language words and sentences are stored once per target language and reused by every
 * pair; everything else belongs to the pair.
 */
export async function generateLanguageLesson(params: LanguageLessonParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const systemPrompt = getSystemPrompt(params);
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
    libraryInput: true,
    systemPrompt,
    task: "language-lesson",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
