import "server-only";
import { type CheckLessonQualityParams } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { loadLessonWritingContext } from "../lessons/_utils/lesson-writing-inputs";

/** One lesson in five made ahead of time gets a later look, like the sample the gate reads. */
const REVIEW_ONE_IN = 5;
const DEFAULT_LIMIT = 100;
const HEX_RADIX = 16;
const HASH_DIGITS = 8;

/** A stable sample: the same lesson is always in or out, so a retry picks the same lessons. */
function isSampled(lessonId: string): boolean {
  return (
    Number.parseInt(lessonId.replaceAll("-", "").slice(-HASH_DIGITS), HEX_RADIX) % REVIEW_ONE_IN ===
    0
  );
}

/**
 * Lessons made ahead of time in the last day (published, and nobody has answered a screen yet)
 * that get a later reasoning check at the flex tier. Advanced lessons are left out: they were
 * checked before they were published.
 */
export async function listLessonsForLaterReview({
  limit = DEFAULT_LIMIT,
}: { limit?: number } = {}): Promise<string[]> {
  const lessons = await prisma.lesson.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true },
    take: limit * REVIEW_ONE_IN,
    where: {
      contentStatus: "completed",
      level: { not: "advanced" },
      steps: { none: { attempts: { some: {} } } },
      targetLanguage: null,
      updatedAt: { gte: new Date(Date.now() - MS_PER_DAY) },
      visibility: "public",
    },
  });

  return lessons
    .map((lesson) => lesson.id)
    .filter((lessonId) => isSampled(lessonId))
    .slice(0, limit);
}

function readSummary(summary: unknown): string[] {
  const ideas = isJsonObject(summary) && Array.isArray(summary.ideas) ? summary.ideas : [];

  return ideas.flatMap((idea) =>
    isJsonObject(idea) && typeof idea.text === "string" ? [idea.text] : [],
  );
}

/** What the later check reads: the lesson's plan, its screens as stored and the model that wrote them. */
export type LaterReviewInput = Omit<
  CheckLessonQualityParams,
  "analytics" | "model" | "reasoning" | "serviceTier" | "useFallback"
>;

/**
 * The reviewer's input for one published lesson, checked against the plan it was written from.
 * Null when the lesson has no readable plan or no screens.
 */
export async function prepareLaterReview(lessonId: string): Promise<LaterReviewInput | null> {
  const [context, lesson] = await Promise.all([
    loadLessonWritingContext(lessonId),
    prisma.lesson.findUnique({
      select: {
        steps: { orderBy: { position: "asc" }, select: { content: true, kind: true, model: true } },
        summary: true,
      },
      where: { id: lessonId },
    }),
  ]);

  const writerModel = lesson?.steps[0]?.model;

  if (!context || !lesson || !writerModel) {
    return null;
  }

  return {
    ...context,
    lesson: {
      screens: lesson.steps.map(({ content, kind }) => ({ content, kind })),
      summary: readSummary(lesson.summary),
    },
    writerModel,
  };
}

/**
 * Whether a later review takes a published lesson out of play. The lesson already passed the gate,
 * and a fresh review always finds something new to polish, so like the gate after its fix pass
 * only something wrong (a blocking `incorrect` issue) pulls it; style, level, scope, repetition and
 * weak checks stay suggestions.
 */
export function failsLaterReview(
  issues: readonly { kind: string; severity: string }[] | null | undefined,
): boolean {
  return (issues ?? []).some(
    (issue) => issue.severity === "blocking" && issue.kind === "incorrect",
  );
}

/**
 * Takes a published lesson that failed a later check out of play: nobody sees it until a new
 * version passes the gate. Only a lesson still published changes, so a lesson rewritten meanwhile
 * is left alone.
 */
export async function pullLessonForFix(lessonId: string): Promise<boolean> {
  const { count } = await prisma.lesson.updateMany({
    data: { contentStatus: "failed" },
    where: { contentStatus: "completed", id: lessonId },
  });

  if (count > 0) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return count > 0;
}
