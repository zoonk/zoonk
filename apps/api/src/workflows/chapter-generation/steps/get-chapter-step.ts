import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { getAiGenerationChapterWhere, prisma } from "@zoonk/db";
import { FatalError } from "workflow";

async function getChapterForGeneration(chapterId: number) {
  return prisma.chapter.findFirst({
    include: {
      _count: { select: { lessons: true } },
      course: true,
    },
    where: getAiGenerationChapterWhere({
      chapterWhere: { id: chapterId },
    }),
  });
}

const NEIGHBOR_RANGE = 3;

async function getNeighboringChapters(courseId: number, position: number) {
  return prisma.chapter.findMany({
    orderBy: { position: "asc" },
    select: { description: true, title: true },
    where: getAiGenerationChapterWhere({
      chapterWhere: {
        courseId,
        position: {
          gte: position - NEIGHBOR_RANGE,
          lte: position + NEIGHBOR_RANGE,
          not: position,
        },
      },
    }),
  });
}

export type ChapterContext = NonNullable<Awaited<ReturnType<typeof getChapterForGeneration>>> & {
  neighboringChapters: { description: string; title: string }[];
};

export async function getChapterStep(chapterId: number): Promise<ChapterContext> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "getChapter" });

  const chapter = await getChapterForGeneration(chapterId);

  if (!chapter) {
    await stream.error({ reason: "notFound", step: "getChapter" });
    throw new FatalError("Chapter not found");
  }

  const neighboringChapters = await getNeighboringChapters(chapter.courseId, chapter.position);

  await stream.status({ status: "completed", step: "getChapter" });

  return { ...chapter, neighboringChapters };
}
