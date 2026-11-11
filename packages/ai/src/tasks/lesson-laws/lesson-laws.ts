import "server-only";
import { normalizeString } from "@zoonk/utils/string";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions, chooseServiceTier } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { normalizeResearchPlan } from "../research/research-plan";
import systemPrompt from "./lesson-laws.prompt.md";

/**
 * On 16 lessons from 7 countries and the EU (11 Nov 2026), Luna scored 10.00 at $0.23/1k (p50 5.1 s)
 * and hinted art. 4 of Lei 12.813/2013 on 3 of 4 runs; Terra also scored 10.00, at $1.97/1k. Haiku
 * 5.5 scored 9.98 at $0.44/1k, missing that article. Flash Lite (9.94, $0.57/1k) filed Lei
 * 9.784's impedimento articles under Lei 8.112 on both runs, which would fetch the wrong law.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["anthropic/claude-haiku-5.5"] as const;

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

const ARTICLE_WORD = /^(?:art(?:igo|ículo|icle|ikel)?s?|sec(?:tion)?s?|s|§+)\.?\s*/iu;
const ORDINAL_MARK = /\.?[º°ª]$/u;

/** "Art. 5º, LXVIII", "§ 622" and "s. 4" read as articles "5", "622" and "4". */
export function toArticleNumber(article: string): string {
  const [number = ""] = article.trim().replace(ARTICLE_WORD, "").split(",");

  return number.trim().replace(ORDINAL_MARK, "");
}

function toArticleNumbers(articles: readonly string[]): string[] {
  const numbers = articles.map((article) => toArticleNumber(article)).filter(Boolean);

  return [...new Set(numbers)].slice(0, MAX_ARTICLES);
}

function normalizeLaw(law: LessonLaw): LessonLaw {
  return normalizeResearchPlan({
    ...law,
    articles: toArticleNumbers(law.articles),
    name: law.name.trim(),
  });
}

function getLawKey(law: LessonLaw): string {
  return [law.country, law.language, normalizeString(law.name)].join(":");
}

/** A law written twice, each time with other articles, is one law with all of them. */
function mergeRepeatedLaws(laws: readonly LessonLaw[]): LessonLaw[] {
  return [...Map.groupBy(laws, (law) => getLawKey(law)).values()].flatMap(([first, ...repeats]) =>
    first
      ? [
          {
            ...first,
            articles: toArticleNumbers([first, ...repeats].flatMap((law) => law.articles)),
          },
        ]
      : [],
  );
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

  const laws = mergeRepeatedLaws(
    result.output.laws.map((law) => normalizeLaw(law)).filter((law) => law.name),
  ).slice(0, MAX_LAWS);

  return { data: { laws }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
