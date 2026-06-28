import "server-only";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import promptTemplate from "./course-categories.prompt.md";

const defaultModel = "google/gemini-3.1-flash-lite";

const fallbackModels = [
  "openai/gpt-5.4-nano",
  "anthropic/claude-haiku-4.5",
  "meta/llama-4-scout",
] as const;

/**
 * Categories available for AI assignment.
 * "languages" is excluded because language courses are categorized deterministically.
 */
const AI_CATEGORIES = COURSE_CATEGORIES.filter(
  (cat): cat is Exclude<(typeof COURSE_CATEGORIES)[number], "languages"> => cat !== "languages",
);

const schema = z.object({ categories: z.array(z.enum(AI_CATEGORIES)) });

export type CourseCategoriesSchema = z.infer<typeof schema>;

export type CourseCategoriesParams = {
  courseTitle: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

export async function generateCourseCategories({
  courseTitle,
  model = defaultModel,
  useFallback = true,
  reasoning,
}: CourseCategoriesParams) {
  const userPrompt = `
    COURSE_TITLE: ${courseTitle}
  `;

  const systemPrompt = promptTemplate.replace("{{CATEGORIES}}", () => AI_CATEGORIES.join(", "));

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
