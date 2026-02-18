import { randomUUID } from "node:crypto";
import { type Chapter, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

export function chapterAttrs(
  attrs?: Partial<Chapter>,
): Omit<Chapter, "id" | "createdAt" | "updatedAt"> {
  const title = attrs?.title ?? "Test Chapter";
  const normalizedTitle = attrs?.normalizedTitle ?? normalizeString(title);

  return {
    courseId: 0,
    description: "Test chapter description",
    generationRunId: null,
    generationStatus: "completed",
    isLocked: false,
    isPublished: false,
    language: "en",
    normalizedTitle,
    organizationId: 0,
    position: 0,
    slug: `test-chapter-${randomUUID()}`,
    title,
    ...attrs,
  };
}

export async function chapterFixture(attrs?: Partial<Chapter>) {
  const chapter = await prisma.chapter.create({ data: chapterAttrs(attrs) });
  return chapter;
}
