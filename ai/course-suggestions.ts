import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./course-suggestions.md";

const model = process.env.AI_MODEL_COURSE_SUGGESTIONS || "openai/gpt-4.1";

const schema = z.object({
  courses: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    }),
  ),
});

export async function generateCourseSuggestions({
  locale,
  prompt,
}: {
  locale: string;
  prompt: string;
}) {
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

  return { suggestions: object.courses, usage };
}
