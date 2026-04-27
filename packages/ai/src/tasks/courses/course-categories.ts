import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import promptTemplate from "./course-categories.prompt.md";

const taskName = "course-categories";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

/**
 * Categories available for AI assignment.
 * "languages" is excluded because language courses are categorized deterministically.
 */
const AI_CATEGORIES = COURSE_CATEGORIES.filter(
  (cat): cat is Exclude<(typeof COURSE_CATEGORIES)[number], "languages"> => cat !== "languages",
);

const schema = z.object({
  categories: z.array(z.enum(AI_CATEGORIES)),
});

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
  const systemPrompt = promptTemplate.replace("{{CATEGORIES}}", () => AI_CATEGORIES.join(", "));

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    taskName,
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
