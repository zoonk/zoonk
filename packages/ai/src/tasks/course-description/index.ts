import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./prompt.md";

const schema = z.object({
  description: z.string(),
});

export type CourseDescriptionSchema = z.infer<typeof schema>;

export type CourseDescriptionParams = {
  title: string;
  locale: string;
  model: string;
};

export async function generateCourseDescription({
  title,
  locale,
  model,
}: CourseDescriptionParams) {
  const userPrompt = `
    COURSE_TITLE: ${title}
    LANGUAGE: ${locale}
  `;

  const { object, usage } = await generateObject({
    model,
    prompt: userPrompt,
    schema,
    system: systemPrompt,
  });

  return { data: object, systemPrompt, usage, userPrompt };
}
