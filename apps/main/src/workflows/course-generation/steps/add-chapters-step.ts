import { prisma } from "@zoonk/db";
import { normalizeString, toSlug } from "@zoonk/utils/string";

import { streamStatus } from "../stream-status";

type Chapter = { title: string; description: string };
type Input = {
  courseId: number;
  chapters: Chapter[];
  locale: string;
  organizationId: number;
};

export async function addChaptersStep(input: Input): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addChapters" });

  const chapterData = input.chapters.map((chapter, index) => ({
    courseId: input.courseId,
    description: chapter.description,
    generationStatus: "pending",
    isPublished: true,
    language: input.locale,
    normalizedTitle: normalizeString(chapter.title),
    organizationId: input.organizationId,
    position: index,
    slug: toSlug(chapter.title),
    title: chapter.title,
  }));

  await prisma.chapter.createMany({ data: chapterData });

  await streamStatus({ status: "completed", step: "addChapters" });
}
