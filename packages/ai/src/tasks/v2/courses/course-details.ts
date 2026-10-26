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
 * From the course-details eval (10 cases in English and Portuguese, code checks
 * then Astra judge with a plain-promise criterion, 14 Oct 2026): Luna scored
 * 9.37 and 9.39 over two runs (EN 9.51 and 9.55, PT 9.23 and 9.23) at about
 * $0.61 per 1,000 courses. It's the cheapest candidate, so nothing cheaper was
 * run; fallbacks come from other families. Once the page's lists got short (25 Oct 2026, a rubric
 * that also judges short items), it scored 9.10, 9.18 and 9.16 over three runs at about $0.90 per
 * 1,000 courses, since it reasons longer to fit the word limits.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash", "anthropic/claude-haiku-5.5"] as const;

/**
 * Language courses are listed under `languages` and exam courses under `exams` because of what
 * they are, never by a model.
 */
const FORMAT_CATEGORIES: ReadonlySet<CourseCategory> = new Set(["exams", "languages"]);

/** The categories the model picks from. */
export const SUBJECT_CATEGORIES = COURSE_CATEGORIES.filter(
  (category) => !FORMAT_CATEGORIES.has(category),
);

const systemPrompt = promptTemplate.replace("{{CATEGORIES}}", () => SUBJECT_CATEGORIES.join(", "));

/** The same rendered prompt hash the details writer records, without generating anything. */
export function getCourseDetailsPromptVersion(): string {
  return getPromptVersion({ systemPrompt });
}

/**
 * The course page's lists as the prompt asks for them, so a visitor takes each in at a glance: how
 * many items it shows and how many words an item has at most.
 */
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

/** What a course page shows before anyone starts it; `landingPage` is stored as it is here. */
export type CourseDetails = {
  categories: CourseCategory[];
  description: string;
  landingPage: { audience: string[]; outcomes: string[]; valueProposition: string };
};

type DetailsChapter = { description: string; level: string; title: string };

export type CourseDetailsParams = {
  courseTitle: string;
  language: string;
  /** The language being learned, for language courses. */
  targetLanguage?: string | null;
  /** The chapters written so far, so the copy names what the course really covers. */
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
 * How a course page in each language words what the learner will be able to do. An imperative
 * reads as an instruction to the visitor, so Romance languages take the infinitive and German an
 * infinitive phrase with the verb last, as its learning goals are written.
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

/**
 * Trims, drops a final period and empty items, and keeps the first of items that only differ in
 * case or accents.
 */
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

/**
 * Writes what a shared course's public page shows before anyone starts it, in one call: the
 * short description, the landing copy (value, audience and outcomes) and one or two categories,
 * which list the course in the catalog and pick its images' palette. It reads the outline
 * written so far, so the copy names what the course covers.
 */
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
