import "server-only";
import { COURSE_CATEGORIES, type CourseCategory } from "@zoonk/utils/categories";
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
 * From the course-details eval (6 cases in English and Portuguese, code checks
 * then Astra judge, 27 Sep 2026): Luna scored 9.71 (EN 9.83, PT 9.59) at
 * $0.41 per 1,000 courses, p50 5.5s. It's the cheapest candidate, so nothing
 * cheaper was run; fallbacks come from other families.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash", "anthropic/claude-haiku-5.5"] as const;

/** Language courses are listed under `languages` because of what they are, never by a model. */
const SUBJECT_CATEGORIES = COURSE_CATEGORIES.filter((category) => category !== "languages");

const systemPrompt = promptTemplate.replace("{{CATEGORIES}}", () => SUBJECT_CATEGORIES.join(", "));

/** How many items each list on the course page shows at most, and how many categories a course has. */
const LIMITS = { audience: 5, categories: 2, outcomes: 6 } as const;

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

function buildUserPrompt(params: CourseDetailsParams): string {
  const targetLanguage = params.targetLanguage
    ? getPromptLanguageName({ language: params.targetLanguage, userLanguage: params.language })
    : "none";

  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    COURSE_TITLE: ${params.courseTitle}
    TARGET_LANGUAGE: ${targetLanguage}
    CHAPTERS: ${formatChapters(params.chapters)}

${formatLocalContext(params.language)}
  `;
}

/** Trims, drops empty items and keeps the first of items that only differ in case or accents. */
function cleanList({ items, max }: { items: readonly string[]; max: number }): string[] {
  const trimmed = items.map((item) => item.trim()).filter(Boolean);
  const keys = trimmed.map((item) => normalizeString(item));

  return trimmed.filter((_, index) => keys.indexOf(keys[index] ?? "") === index).slice(0, max);
}

function normalizeCourseDetails(raw: RawCourseDetails): CourseDetails {
  return {
    categories: [...new Set(raw.categories)].slice(0, LIMITS.categories),
    description: raw.description.trim(),
    landingPage: {
      audience: cleanList({ items: raw.audience, max: LIMITS.audience }),
      outcomes: cleanList({ items: raw.outcomes, max: LIMITS.outcomes }),
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
    systemPrompt,
    task: "course-details",
  });

  const data = normalizeCourseDetails(result.output);

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
