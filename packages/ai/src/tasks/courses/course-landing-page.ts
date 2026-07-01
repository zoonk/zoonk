import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { type CourseChapter } from "./course-chapters";
import systemPrompt from "./course-landing-page.prompt.md";

const defaultModel = "openai/gpt-5.4";
const fallbackModels = ["anthropic/claude-opus-4.8", "openai/gpt-5.5"] as const;

const schema = z.object({
  audience: z.array(z.string()),
  opportunities: z.array(z.string()),
  outcomes: z.array(z.string()),
  valueProposition: z.string(),
});

type LandingPageChapter = Pick<CourseChapter, "description" | "title">;

export type CourseLandingPageSchema = z.infer<typeof schema>;

export type CourseLandingPageParams = {
  chapters?: LandingPageChapter[] | null;
  description?: string | null;
  language: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage?: string | null;
  title: string;
  useFallback?: boolean;
};

/**
 * Keeps the chapter context compact and predictable for the prompt. Landing
 * copy needs the curriculum shape, but the model should not receive database
 * fields, generation state, slugs, or IDs that do not help marketing copy.
 */
function getChapterContext(chapters: LandingPageChapter[] | null | undefined): string {
  if (!chapters?.length) {
    return "[]";
  }

  const promptChapters = chapters.map(({ description, title }) => ({ description, title }));

  return JSON.stringify(promptChapters, null, 2);
}

/**
 * Generates the structured marketing copy that the course page needs before a
 * learner has started. Keeping this separate from the short description lets
 * the UI render fit, outcomes, and opportunities as distinct landing sections
 * without asking the page to infer them from one paragraph.
 */
export async function generateCourseLandingPage({
  chapters,
  description,
  language,
  model = defaultModel,
  reasoningEffort,
  targetLanguage,
  title,
  useFallback = true,
}: CourseLandingPageParams) {
  const promptLanguage = getPromptLanguageName({ language });

  const targetLanguageName = targetLanguage
    ? getPromptLanguageName({ language: targetLanguage, userLanguage: language })
    : "";

  const userPrompt = `
    COURSE_TITLE: ${title}
    COURSE_DESCRIPTION: ${description ?? ""}
    CHAPTERS: ${getChapterContext(chapters)}
    LANGUAGE: ${promptLanguage}
    TARGET_LANGUAGE: ${targetLanguageName}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
