import { randomUUID } from "node:crypto";
import { type Lesson, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

export function lessonAttrs(
  attrs?: Partial<Lesson>,
): Omit<Lesson, "id" | "createdAt" | "updatedAt"> {
  const title = attrs?.title ?? "Test Lesson";
  const normalizedTitle = attrs?.normalizedTitle ?? normalizeString(title);

  return {
    chapterId: 0,
    description: "Test lesson description",
    generationRunId: null,
    generationStatus: "completed",
    isPublished: false,
    kind: "core",
    language: "en",
    normalizedTitle,
    organizationId: 0,
    position: 0,
    slug: `test-lesson-${randomUUID()}`,
    title,
    ...attrs,
  };
}

export async function lessonFixture(attrs?: Partial<Lesson>) {
  const lesson = await prisma.lesson.create({ data: lessonAttrs(attrs) });
  return lesson;
}
