import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import system from "./course-suggestions-prompt.md";

const model = process.env.AI_MODEL_COURSE_SUGGESTIONS || "openai/gpt-4.1";

export type CourseSuggestionParams = {
  locale: string;
  prompt: string;
};

export const courseSuggestionsSchema = z.object({
  courses: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    }),
  ),
});

export function getUserPrompt(params: CourseSuggestionParams) {
  return `
    APP_LANGUAGE: ${params.locale}
    USER_INPUT: ${params.prompt}
  `.trim();
}

export async function generateCourseSuggestions(
  params: CourseSuggestionParams,
) {
  const { object } = await generateObject({
    model,
    schema: courseSuggestionsSchema,
    system,
    prompt: getUserPrompt(params),
  });

  return object.courses;
}
