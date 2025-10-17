import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./course-suggestions.md";

const schema = z.object({
  courses: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
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
    schema,
    prompt: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return { data: object.courses, usage, userPrompt, systemPrompt };
}
