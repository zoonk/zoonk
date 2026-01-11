import { prisma } from "@zoonk/db";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type Chapter = { title: string; description: string };
type Input = {
  courseId: number;
  chapters: Chapter[];
  locale: string;
  organizationId: number;
};

export async function addChaptersStep(input: Input): Promise<void> {
  "use step";

  const chapterData = input.chapters.map((chapter, index) => ({
    courseId: input.courseId,
    description: chapter.description,
    generationStatus: "pending",
    language: input.locale,
    normalizedTitle: normalizeString(chapter.title),
    organizationId: input.organizationId,
    position: index,
    slug: toSlug(chapter.title),
    title: chapter.title,
  }));

  await prisma.chapter.createMany({ data: chapterData });
}
