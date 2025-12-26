import { randomUUID } from "node:crypto";
import { type Chapter, type CourseChapter, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

export function chapterAttrs(
  attrs?: Partial<Chapter>,
): Omit<Chapter, "id" | "createdAt" | "updatedAt"> {
  const title = attrs?.title ?? "Test Chapter";
  const normalizedTitle = attrs?.normalizedTitle ?? normalizeString(title);

  return {
    description: "Test chapter description",
    isPublished: false,
    normalizedTitle,
    organizationId: 0,
    slug: `test-chapter-${randomUUID()}`,
    title,
    ...attrs,
  };
}

export async function chapterFixture(attrs?: Partial<Chapter>) {
  const chapter = await prisma.chapter.create({ data: chapterAttrs(attrs) });
  return chapter;
}

export async function courseChapterFixture(
  attrs: Omit<CourseChapter, "id" | "createdAt">,
) {
  const courseChapter = await prisma.courseChapter.create({
    data: {
      chapterId: attrs.chapterId,
      courseId: attrs.courseId,
      position: attrs.position,
    },
  });
  return courseChapter;
}
