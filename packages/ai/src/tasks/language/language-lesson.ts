import "server-only";
import { isSameLanguage, usesNonLatinScript } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import {
  type Reasoning,
  type ServedSpeed,
  type ServiceTier,
  buildProviderOptions,
} from "../../provider-options";
import { formatLocalContext } from "../_utils/language-context";
import { getLanguagePromptContext } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { type LessonProblem, formatLessonProblems } from "../lesson-writer/format-lesson-plan";
import fixPrompt from "./language-lesson-fix.prompt.md";
import respellingForEnglish from "./language-lesson-respelling-en.prompt.md";
import respellingForSpanish from "./language-lesson-respelling-es.prompt.md";
import respellingForPortuguese from "./language-lesson-respelling-pt.prompt.md";
import basePrompt from "./language-lesson.prompt.md";

/**
 * Written once per pair and shared, so quality wins: on 15 cases (8 Nov 2026), Terra scored 8.95
 * (EN 9.18, PT 8.74) at $12.96/1k; Luna at high reasoning scored 8.33 and wrote an English
 * speaker's instructions in Portuguese. Gemini 3.8 Flash (7.36) is below the floor, so it's only an
 * outage route.
 */
const defaultModel = "openai/gpt-6.1-terra";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

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
        distractors: z.array(z.string()).min(1),
      }),
    )
    .min(1),
  sentences: z
    .array(
      z.object({
        sentence: z.string(),
        translation: z.string(),
        explanation: z.string(),
        romanization: z.string().nullable(),
        distractors: z.array(z.string()),
        translationDistractors: z.array(z.string()),
        speakingPrompt: z.string().nullable(),
      }),
    )
    .min(1),
  tip: z.object({
    title: z.string(),
    text: z.string(),
    examples: z.array(z.object({ sentence: z.string(), translation: z.string() })),
  }),
  practice: z
    .array(
      z.object({
        question: z.string().nullable(),
        template: z.string(),
        answer: z.string(),
        distractors: z.array(z.string()).min(1),
        feedback: z.string(),
      }),
    )
    .min(1),
  writing: z.object({
    prompt: z.string(),
    answers: z.array(z.string()).min(1),
    keyPoints: z.array(z.string()).min(1),
  }),
  summary: z.array(z.string()).min(1),
});
/* oxlint-enable eslint/sort-keys */

export type LanguageLessonContent = z.infer<typeof schema>;

export type LanguageLessonInputs = {
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
};

export type LanguageLessonParams = LanguageLessonInputs & {
  model?: string;
  serviceTier?: ServiceTier;
  speed?: ServedSpeed;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatList(values: readonly string[] | undefined): string {
  return values && values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "none";
}

export function formatLanguageLessonInputs(params: LanguageLessonInputs): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}
${formatLocalContext(params.targetLanguage, { register: false })}
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

async function runLanguageLessonTask({
  instructions,
  params,
  task,
  userPrompt,
}: {
  instructions: string;
  params: LanguageLessonParams;
  task: string;
  userPrompt: string;
}) {
  const {
    analytics,
    model = defaultModel,
    reasoning,
    serviceTier,
    speed,
    useFallback = true,
  } = params;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    serviceTier,
    speed,
    useFallback,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt: instructions,
    task,
  });

  return {
    data: result.output,
    provenance,
    systemPrompt: instructions,
    usage: result.usage,
    userPrompt,
  };
}

/**
 * Target-language words and sentences are stored once per target language and reused by every
 * pair; everything else belongs to the pair.
 */
export async function generateLanguageLesson(params: LanguageLessonParams) {
  return runLanguageLessonTask({
    instructions: getSystemPrompt(params),
    params,
    task: "language-lesson",
    userPrompt: formatLanguageLessonInputs(params),
  });
}

export type FixLanguageLessonParams = LanguageLessonParams & {
  lesson: LanguageLessonContent;
  /** The screens the reviewer numbered, in the order learners see them. */
  screens: readonly { kind: string; content: unknown }[];
  /** `screen` indexes `screens`, or is null for the whole lesson. */
  problems: readonly LessonProblem[];
};

/** Returns the whole lesson; the writer may leave it unchanged when it finds a problem isn't real. */
export async function fixLanguageLesson(params: FixLanguageLessonParams) {
  const screens = params.screens.map((screen, index) => ({ screen: index + 1, ...screen }));

  const userPrompt = `${formatLanguageLessonInputs(params)}
LESSON:
${JSON.stringify(params.lesson, null, 1)}

SCREENS:
${JSON.stringify(screens, null, 1)}

PROBLEMS:
${formatLessonProblems(params.problems)}
`;

  return runLanguageLessonTask({
    instructions: `${getSystemPrompt(params)}\n${fixPrompt}`,
    params,
    task: "language-lesson-fix",
    userPrompt,
  });
}
