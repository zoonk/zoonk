import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./chapter-lessons.md";

const schema = z.object({
  description: z.string(),
  lessons: z.array(z.string()),
});

export type ChapterLessonsSchema = z.infer<typeof schema>;

export type ChapterLessonsParams = {
  courseTitle: string;
  chapterTitle: string;
  locale: string;
  model: string;
};

export async function generateChapterLessons({
  courseTitle,
  chapterTitle,
  locale,
  model,
}: ChapterLessonsParams) {
  const userPrompt = `
    APP_LANGUAGE: ${locale}
    COURSE_TITLE: ${courseTitle}
    CHAPTER_TITLE: ${chapterTitle}
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
