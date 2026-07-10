import "server-only";
import { AI_COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import promptTemplate from "./course-categories.prompt.md";

const defaultModel = "google/gemini-3.1-flash-lite";

const fallbackModels = ["deepseek/deepseek-v4-flash", "openai/gpt-5.4-mini"] as const;

const schema = z.object({ categories: z.array(z.enum(AI_COURSE_CATEGORIES)) });

export type CourseCategoriesSchema = z.infer<typeof schema>;

export type CourseCategoriesParams = {
  courseTitle: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateCourseCategories({
  courseTitle,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: CourseCategoriesParams) {
  const userPrompt = `
    COURSE_TITLE: ${courseTitle}
  `;

  const systemPrompt = promptTemplate.replace("{{CATEGORIES}}", () =>
    AI_COURSE_CATEGORIES.join(", "),
  );

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
