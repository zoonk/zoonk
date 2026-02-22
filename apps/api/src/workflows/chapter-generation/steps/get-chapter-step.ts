import { prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { streamError, streamStatus } from "../stream-status";

async function getChapterForGeneration(chapterId: number) {
  return prisma.chapter.findUnique({
    select: {
      _count: {
        select: {
          lessons: true,
        },
      },
      course: {
        select: {
          slug: true,
          targetLanguage: true,
          title: true,
        },
      },
      courseId: true,
      description: true,
      generationRunId: true,
      generationStatus: true,
      id: true,
      language: true,
      organizationId: true,
      position: true,
      slug: true,
      title: true,
    },
    where: { id: chapterId },
  });
}

const NEIGHBOR_RANGE = 3;

async function getNeighboringChapters(courseId: number, position: number) {
  return prisma.chapter.findMany({
    orderBy: { position: "asc" },
    select: { description: true, title: true },
    where: {
      courseId,
      position: {
        gte: position - NEIGHBOR_RANGE,
        lte: position + NEIGHBOR_RANGE,
        not: position,
      },
    },
  });
}

export type ChapterContext = NonNullable<Awaited<ReturnType<typeof getChapterForGeneration>>> & {
  neighboringChapters: { description: string; title: string }[];
};

export async function getChapterStep(chapterId: number): Promise<ChapterContext> {
  "use step";

  await streamStatus({ status: "started", step: "getChapter" });

  const chapter = await getChapterForGeneration(chapterId);

  if (!chapter) {
    await streamError({ reason: "notFound", step: "getChapter" });
    throw new FatalError("Chapter not found");
  }

  const neighboringChapters = await getNeighboringChapters(chapter.courseId, chapter.position);

  await streamStatus({ status: "completed", step: "getChapter" });

  return { ...chapter, neighboringChapters };
}
