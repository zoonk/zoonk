import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./course-chapters.md";

const schema = z.object({
  description: z.string(),
  chapters: z.array(z.string()),
});

export type CourseChaptersSchema = z.infer<typeof schema>;

export type CourseChaptersParams = {
  courseTitle: string;
  locale: string;
  model: string;
};

export async function generateCourseChapters({
  courseTitle,
  locale,
  model,
}: CourseChaptersParams) {
  const userPrompt = `
    APP_LANGUAGE: ${locale}
    COURSE_TITLE: ${courseTitle}
  `;

  const { object, usage } = await generateObject({
    model,
    schema,
    prompt: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return { data: object, usage, userPrompt, systemPrompt };
}
