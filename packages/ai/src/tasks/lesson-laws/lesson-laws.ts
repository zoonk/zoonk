import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions, chooseServiceTier } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { normalizeResearchPlan } from "../research/research-plan";
import systemPrompt from "./lesson-laws.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

const MAX_LAWS = 3;
const MAX_ARTICLES = 8;

const lawSchema = z.object({
  articles: z.array(z.string()),
  country: z.string(),
  language: z.string(),
  name: z.string(),
  officialDomains: z.array(z.string()),
  queries: z.array(z.string()),
  searchTerms: z.array(z.string()),
});

const schema = z.object({ laws: z.array(lawSchema) });

/**
 * `country` is ISO 3166-1 alpha-2 ("EU" for European Union law) and `language` is the official
 * text's, not the lesson's. `articles` only select which parts of the text a lesson reads; they
 * are never cited.
 */
export type LessonLaw = z.infer<typeof lawSchema>;

export type LessonLawsParams = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  lessonCanDo?: string;
  lessonDescription: string;
  lessonTitle: string;
  skills: string[];
  /** Built for one learner's own goal, so its titles may hold their words. */
  isPrivate: boolean;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

function formatSkills(skills: readonly string[]): string {
  return skills.length === 0 ? "none" : skills.map((skill) => `\n- ${skill}`).join("");
}

function buildUserPrompt(params: LessonLawsParams): string {
  return [
    `LANGUAGE: ${getPromptLanguageName({ language: params.language })}`,
    `COURSE_TITLE: ${params.courseTitle}`,
    `CHAPTER_TITLE: ${params.chapterTitle}`,
    `LESSON_TITLE: ${params.lessonTitle}`,
    `LESSON_DESCRIPTION: ${params.lessonDescription}`,
    `LESSON_CAN_DO: ${params.lessonCanDo ?? "none"}`,
    `SKILLS: ${formatSkills(params.skills)}`,
  ].join("\n");
}

function normalizeLaw(law: LessonLaw): LessonLaw {
  const articles = [...new Set(law.articles.map((article) => article.trim()).filter(Boolean))];

  return normalizeResearchPlan({
    ...law,
    articles: articles.slice(0, MAX_ARTICLES),
    name: law.name.trim(),
  });
}

/** Empty when the lesson teaches no law's numbered provisions or its jurisdiction is unclear. */
export async function generateLessonLaws(params: LessonLawsParams) {
  const { analytics, isPrivate, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    serviceTier: chooseServiceTier({ wait: "soon" }),
    useFallback,
  });

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
    libraryInput: !isPrivate,
    systemPrompt,
    task: "lesson-laws",
  });

  const laws = result.output.laws
    .map((law) => normalizeLaw(law))
    .filter((law) => law.name)
    .slice(0, MAX_LAWS);

  return { data: { laws }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
