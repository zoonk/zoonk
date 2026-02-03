import { prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { streamStatus } from "../stream-status";

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
          title: true,
        },
      },
      description: true,
      generationRunId: true,
      generationStatus: true,
      id: true,
      language: true,
      organizationId: true,
      slug: true,
      title: true,
    },
    where: { id: chapterId },
  });
}

export type ChapterContext = NonNullable<Awaited<ReturnType<typeof getChapterForGeneration>>>;

export async function getChapterStep(chapterId: number): Promise<ChapterContext> {
  "use step";

  await streamStatus({ status: "started", step: "getChapter" });

  const chapter = await getChapterForGeneration(chapterId);

  if (!chapter) {
    await streamStatus({ status: "error", step: "getChapter" });
    throw new FatalError("Chapter not found");
  }

  await streamStatus({ status: "completed", step: "getChapter" });

  return chapter;
}
