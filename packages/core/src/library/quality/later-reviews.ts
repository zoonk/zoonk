import "server-only";
import { type CheckLessonQualityParams } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { loadLessonWritingContext } from "../lessons/_utils/lesson-writing-inputs";
import { loadLessonReuse } from "../lessons/lesson-reuse";
import { CURRENT_STEPS } from "../lessons/lesson-versions";

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
 * that get a later reasoning check at the flex tier. Advanced lessons are left out: every one got
 * the check right after it was published.
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
      steps: { none: { ...CURRENT_STEPS, attempts: { some: {} } } },
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

/**
 * What the later check reads: the lesson's plan, its current screens as stored and the model that
 * wrote them, and the version they are.
 */
export type LaterReviewInput = Omit<
  CheckLessonQualityParams,
  "analytics" | "model" | "reasoning" | "serviceTier" | "useFallback"
> & { version: number };

/**
 * The reviewer's input for one published lesson, checked against the plan it was written from by a
 * reviewer as strong as the lesson is likely to be read again. Null when the lesson has no readable
 * plan or no screens.
 */
export async function prepareLaterReview(lessonId: string): Promise<LaterReviewInput | null> {
  const [context, reuse, lesson] = await Promise.all([
    loadLessonWritingContext(lessonId),
    loadLessonReuse({ lessonId }),
    prisma.lesson.findUnique({
      select: {
        steps: {
          orderBy: { position: "asc" },
          select: { content: true, kind: true, model: true, version: true },
          where: CURRENT_STEPS,
        },
        summary: true,
      },
      where: { id: lessonId },
    }),
  ]);

  const [first] = lesson?.steps ?? [];

  if (!context || !lesson || !first) {
    return null;
  }

  return {
    ...context,
    lesson: {
      screens: lesson.steps.map(({ content, kind }) => ({ content, kind })),
      summary: readSummary(lesson.summary),
    },
    reuse,
    version: first.version,
    writerModel: first.model,
  };
}

/**
 * What a later check found wrong in a published lesson, as a held-back draft's problems: the
 * fresh draft that replaces it is told them. The lesson already passed the gate, and a fresh
 * review always finds something new to polish, so like the gate after its fix pass only something
 * wrong (a blocking `incorrect` issue) counts; style, level, scope, repetition and weak checks
 * stay suggestions. Empty when the lesson passes.
 */
export function toLaterReviewProblems(
  issues: readonly {
    fix: string;
    kind: string;
    problem: string;
    screen: number | null;
    severity: string;
  }[],
): { problem: string; screen: number | null }[] {
  return issues
    .filter((issue) => issue.severity === "blocking" && issue.kind === "incorrect")
    .map((issue) => ({ problem: `${issue.problem} Fix: ${issue.fix}`, screen: issue.screen }));
}

/**
 * Takes a published lesson out of play until it's written again (a source it was built on
 * changed): nobody opens it until a new version passes the gate, and learners playing it finish
 * the version they opened. Only a lesson still published changes, so a lesson rewritten meanwhile
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
