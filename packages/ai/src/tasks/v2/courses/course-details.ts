import "server-only";
import { COURSE_CATEGORIES, type CourseCategory } from "@zoonk/utils/categories";
import { type SupportedLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { normalizeString } from "@zoonk/utils/string";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import promptTemplate from "./course-details.prompt.md";

/**
 * Luna, the cheapest candidate, scored 9.1 to 9.4 on the course-details eval (14 and 25 Oct 2026);
 * fallbacks come from other families.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash", "anthropic/claude-haiku-5.5"] as const;

/** Set by what a course is, never by a model. */
const FORMAT_CATEGORIES: ReadonlySet<CourseCategory> = new Set(["exams", "languages"]);

export const SUBJECT_CATEGORIES = COURSE_CATEGORIES.filter(
  (category) => !FORMAT_CATEGORIES.has(category),
);

const systemPrompt = promptTemplate.replace("{{CATEGORIES}}", () => SUBJECT_CATEGORIES.join(", "));

/** The hash the details writer records, without generating anything. */
export function getCourseDetailsPromptVersion(): string {
  return getPromptVersion({ systemPrompt });
}

export const PAGE_LISTS = {
  audience: { items: 3, words: 6 },
  outcomes: { items: 4, words: 8 },
} as const;

const MAX_CATEGORIES = 2;

/** List items are phrases, so a model's closing period goes. */
const FINAL_PERIOD = /\.$/u;

const schema = z.object({
  audience: z.array(z.string()),
  categories: z.array(z.enum(SUBJECT_CATEGORIES)),
  description: z.string(),
  outcomes: z.array(z.string()),
  valueProposition: z.string(),
});

type RawCourseDetails = z.infer<typeof schema>;

/** `landingPage` is stored as it is here. */
export type CourseDetails = {
  categories: CourseCategory[];
  description: string;
  landingPage: { audience: string[]; outcomes: string[]; valueProposition: string };
};

type DetailsChapter = { description: string; level: string; title: string };

export type CourseDetailsParams = {
  courseTitle: string;
  language: string;
  targetLanguage?: string | null;
  chapters: DetailsChapter[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatChapters(chapters: readonly DetailsChapter[]): string {
  return chapters.length === 0
    ? "none"
    : chapters
        .map((chapter) => `\n- [${chapter.level}] ${chapter.title}: ${chapter.description}`)
        .join("");
}

/**
 * An imperative reads as an instruction to the visitor, so Romance languages take the infinitive
 * and German an infinitive phrase with the verb last.
 */
const OUTCOME_VERB_FORMS: Record<SupportedLocale, string> = {
  de: "an infinitive phrase with the verb at the end, as German learning goals are written",
  en: "the verb's base form at the start",
  es: "the infinitive at the start",
  fr: "the infinitive at the start",
  pt: "the infinitive at the start",
};

function buildUserPrompt(params: CourseDetailsParams): string {
  const targetLanguage = params.targetLanguage
    ? getPromptLanguageName({ language: params.targetLanguage, userLanguage: params.language })
    : "none";

  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    VERB_FORM: ${OUTCOME_VERB_FORMS[getSupportedLocaleFromLanguage(params.language)]}
    COURSE_TITLE: ${params.courseTitle}
    TARGET_LANGUAGE: ${targetLanguage}
    CHAPTERS: ${formatChapters(params.chapters)}

${formatLocalContext(params.language)}
  `;
}

function cleanList({ items, max }: { items: readonly string[]; max: number }): string[] {
  const trimmed = items.map((item) => item.trim().replace(FINAL_PERIOD, "")).filter(Boolean);
  const keys = trimmed.map((item) => normalizeString(item));

  return trimmed.filter((_, index) => keys.indexOf(keys[index] ?? "") === index).slice(0, max);
}

function normalizeCourseDetails(raw: RawCourseDetails): CourseDetails {
  return {
    categories: [...new Set(raw.categories)].slice(0, MAX_CATEGORIES),
    description: raw.description.trim(),
    landingPage: {
      audience: cleanList({ items: raw.audience, max: PAGE_LISTS.audience.items }),
      outcomes: cleanList({ items: raw.outcomes, max: PAGE_LISTS.outcomes.items }),
      valueProposition: raw.valueProposition.trim(),
    },
  };
}

export async function generateCourseDetails(params: CourseDetailsParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
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
    libraryInput: true,
    systemPrompt,
    task: "course-details",
  });

  const data = normalizeCourseDetails(result.output);

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
