import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./course-suggestions.md";

const schema = z.object({
  courses: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type CourseSuggestionSchema = z.infer<typeof schema>;

export type CourseSuggestionsParams = {
  locale: string;
  prompt: string;
  model: string;
};

export async function generateCourseSuggestions({
  locale,
  prompt,
  model,
}: CourseSuggestionsParams) {
  const userPrompt = `
    APP_LANGUAGE: ${locale}
    USER_INPUT: ${prompt}
  `;

  const { object, usage } = await generateObject({
    model,
    prompt: [
      { content: systemPrompt, role: "system" },
      { content: userPrompt, role: "user" },
    ],
    schema,
  });

  return { data: object.courses, systemPrompt, usage, userPrompt };
}
