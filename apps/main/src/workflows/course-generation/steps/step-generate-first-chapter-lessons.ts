import { generateChapterLessons } from "@zoonk/ai/chapter-lessons/generate";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type ChapterInfo = {
  id: number;
  title: string;
  description: string;
};

type GenerateFirstChapterLessonsParams = {
  chapter: ChapterInfo;
  courseTitle: string;
  locale: string;
};

export async function stepGenerateFirstChapterLessons(
  params: GenerateFirstChapterLessonsParams,
) {
  "use step";

  const { data } = await generateChapterLessons({
    chapterDescription: params.chapter.description,
    chapterTitle: params.chapter.title,
    courseTitle: params.courseTitle,
    locale: params.locale,
  });

  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: AI_ORG_SLUG },
  });

  await prisma.$transaction([
    prisma.lesson.createMany({
      data: data.lessons.map((lesson, index) => ({
        chapterId: params.chapter.id,
        description: lesson.description,
        isPublished: true,
        language: params.locale,
        normalizedTitle: normalizeString(lesson.title),
        organizationId: org.id,
        position: index,
        slug: toSlug(lesson.title),
        title: lesson.title,
      })),
    }),
    prisma.chapter.update({
      data: { lessonGenerationStatus: "completed" },
      where: { id: params.chapter.id },
    }),
  ]);

  return { lessonsGenerated: data.lessons.length };
}
