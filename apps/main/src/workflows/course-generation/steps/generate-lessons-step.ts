import { generateChapterLessons } from "@zoonk/ai/chapter-lessons/generate";
import { prisma } from "@zoonk/db";
import { normalizeString, toSlug } from "@zoonk/utils/string";

import { streamStatus } from "../stream-status";

type Chapter = { title: string; description: string };
type Input = {
  courseId: number;
  courseTitle: string;
  chapter: Chapter;
  locale: string;
  organizationId: number;
};

export async function generateLessonsStep(input: Input): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "generateLessons" });

  const dbChapter = await prisma.chapter.findFirst({
    select: { id: true },
    where: {
      courseId: input.courseId,
      position: 0,
    },
  });

  if (!dbChapter) {
    await streamStatus({ status: "completed", step: "generateLessons" });
    return;
  }

  const { data } = await generateChapterLessons({
    chapterDescription: input.chapter.description,
    chapterTitle: input.chapter.title,
    courseTitle: input.courseTitle,
    locale: input.locale,
  });

  const lessonData = data.lessons.map((lesson, index) => ({
    chapterId: dbChapter.id,
    description: lesson.description,
    generationStatus: "pending",
    isPublished: true,
    language: input.locale,
    normalizedTitle: normalizeString(lesson.title),
    organizationId: input.organizationId,
    position: index,
    slug: toSlug(lesson.title),
    title: lesson.title,
  }));

  await prisma.lesson.createMany({ data: lessonData });

  await prisma.chapter.update({
    data: { generationStatus: "completed" },
    where: { id: dbChapter.id },
  });

  await streamStatus({ status: "completed", step: "generateLessons" });
}
