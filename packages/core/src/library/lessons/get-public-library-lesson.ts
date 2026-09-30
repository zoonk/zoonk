import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { type PublicFirstScreen, toPublicFirstScreen } from "./_utils/public-first-screen";
import { toSummaryIdeas } from "./_utils/summary-ideas";

async function getCachedPublicLesson(lessonId: string) {
  "use cache";
  cacheTag(getLibraryLessonCacheTag(lessonId));

  return prisma.lesson.findUnique({
    select: {
      contentStatus: true,
      description: true,
      estimatedMinutes: true,
      id: true,
      language: true,
      slug: true,
      steps: { orderBy: { position: "asc" }, select: { content: true, kind: true }, take: 1 },
      summary: true,
      title: true,
      updatedAt: true,
      visibility: true,
    },
    where: { id: lessonId },
  });
}

/**
 * The public part of a shared lesson: title, why it matters, what you'll
 * learn (the summary ideas) and its first screen without the answer. The
 * first screen is null until the content is written; the page then offers to
 * start the lesson, which writes it. Everything else loads in the player.
 * Private lessons are never public.
 */
export async function getPublicLibraryLesson({ lessonId }: { lessonId: string }) {
  if (!isUuid(lessonId)) {
    return null;
  }

  const lesson = await getCachedPublicLesson(lessonId);

  if (!lesson || lesson.visibility !== "public") {
    return null;
  }

  const [firstStep] = lesson.steps;
  const isWritten = lesson.contentStatus === "completed" && firstStep !== undefined;
  const firstScreen: PublicFirstScreen | null = isWritten ? toPublicFirstScreen(firstStep) : null;

  return {
    description: lesson.description,
    estimatedMinutes: lesson.estimatedMinutes,
    firstScreen,
    id: lesson.id,
    language: lesson.language,
    slug: lesson.slug,
    summaryIdeas: toSummaryIdeas(lesson.summary),
    title: lesson.title,
    updatedAt: lesson.updatedAt,
  };
}

export type PublicLibraryLesson = NonNullable<Awaited<ReturnType<typeof getPublicLibraryLesson>>>;
