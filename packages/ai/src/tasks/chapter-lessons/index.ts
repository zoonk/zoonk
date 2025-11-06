import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./prompt.md";

const schema = z.object({
  lessons: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type ChapterLessonsSchema = z.infer<typeof schema>;

export type ChapterLessonsParams = {
  chapterDescription: string;
  chapterTitle: string;
  courseTitle: string;
  locale: string;
  model: string;
};

export async function generateChapterLessons({
  chapterDescription,
  chapterTitle,
  courseTitle,
  locale,
  model,
}: ChapterLessonsParams) {
  const userPrompt = `
    LANGUAGE: ${locale}
    COURSE_TITLE: ${courseTitle}
    CHAPTER_TITLE: ${chapterTitle}
    CHAPTER_DESCRIPTION: ${chapterDescription}
  `;

  const { object, usage } = await generateObject({
    model,
    prompt: userPrompt,
    schema,
    system: systemPrompt,
  });

  return { data: object, systemPrompt, usage, userPrompt };
}
