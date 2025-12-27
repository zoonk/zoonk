import { randomUUID } from "node:crypto";
import { type ChapterLesson, type Lesson, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

export function lessonAttrs(
  attrs?: Partial<Lesson>,
): Omit<Lesson, "id" | "createdAt" | "updatedAt"> {
  const title = attrs?.title ?? "Test Lesson";
  const normalizedTitle = attrs?.normalizedTitle ?? normalizeString(title);

  return {
    description: "Test lesson description",
    isPublished: false,
    normalizedTitle,
    organizationId: 0,
    slug: `test-lesson-${randomUUID()}`,
    title,
    ...attrs,
  };
}

export async function lessonFixture(attrs?: Partial<Lesson>) {
  const lesson = await prisma.lesson.create({ data: lessonAttrs(attrs) });
  return lesson;
}

export async function chapterLessonFixture(
  attrs: Omit<ChapterLesson, "id" | "createdAt">,
) {
  const chapterLesson = await prisma.chapterLesson.create({
    data: {
      chapterId: attrs.chapterId,
      lessonId: attrs.lessonId,
      position: attrs.position,
    },
  });
  return chapterLesson;
}
