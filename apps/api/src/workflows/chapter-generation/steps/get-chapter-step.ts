import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { type Course, getAiGenerationChapterWhere, prisma } from "@zoonk/db";
import { FatalError } from "workflow";

/**
 * Derives the language-generation target from the course format. Non-language
 * formats ignore stale target values, while language courses must provide a
 * distinct target before any language-specific lesson work can start.
 */
export function getChapterGenerationTargetLanguage(
  course: Pick<Course, "format" | "language" | "targetLanguage">,
): string | null {
  if (course.format !== "language") {
    return null;
  }

  if (!course.targetLanguage || course.targetLanguage === course.language) {
    throw new FatalError("Language course is missing a valid target language");
  }

  return course.targetLanguage;
}

async function getChapterForGeneration(chapterId: string) {
  return prisma.chapter.findFirst({
    include: { _count: { select: { lessons: true } }, course: true },
    where: getAiGenerationChapterWhere({ chapterWhere: { id: chapterId } }),
  });
}

const NEIGHBOR_RANGE = 3;

async function getNeighboringChapters(courseId: string, position: number) {
  return prisma.chapter.findMany({
    orderBy: { position: "asc" },
    select: { description: true, title: true },
    where: getAiGenerationChapterWhere({
      chapterWhere: {
        courseId,
        position: { gte: position - NEIGHBOR_RANGE, lte: position + NEIGHBOR_RANGE, not: position },
      },
    }),
  });
}

export type ChapterContext = NonNullable<Awaited<ReturnType<typeof getChapterForGeneration>>> & {
  neighboringChapters: { description: string; title: string }[];
};

export async function getChapterStep(chapterId: string): Promise<ChapterContext> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "getChapter" });

  const chapter = await getChapterForGeneration(chapterId);

  if (!chapter) {
    await stream.error({ reason: "notFound", step: "getChapter" });
    throw new FatalError("Chapter not found");
  }

  getChapterGenerationTargetLanguage(chapter.course);

  const neighboringChapters = await getNeighboringChapters(chapter.courseId, chapter.position);

  await stream.status({ status: "completed", step: "getChapter" });

  return { ...chapter, neighboringChapters };
}
