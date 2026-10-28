import "server-only";
import { type CheckLessonQualityParams } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { safeAsync } from "@zoonk/utils/error";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { resolvePlanInputDependents } from "../../plans/_utils/plan-input-dependencies";
import { loadLessonWritingContext } from "../lessons/_utils/lesson-writing-inputs";
import { loadLessonReuse } from "../lessons/lesson-reuse";
import { CURRENT_STEPS } from "../lessons/lesson-versions";

const REVIEW_ONE_IN = 5;
const DEFAULT_LIMIT = 100;
const HEX_RADIX = 16;
const HASH_DIGITS = 8;

function isSampled(lessonId: string): boolean {
  return (
    Number.parseInt(lessonId.replaceAll("-", "").slice(-HASH_DIGITS), HEX_RADIX) % REVIEW_ONE_IN ===
    0
  );
}

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

export type LaterReviewInput = Omit<
  CheckLessonQualityParams,
  "analytics" | "model" | "reasoning" | "serviceTier" | "useFallback"
> & { version: number };

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

class LessonPullLostError extends Error {
  override name = "LessonPullLostError";
}

export async function pullLessonForFix(lessonId: string): Promise<boolean> {
  const { data: pulled, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      const current = await tx.lesson.findFirst({
        include: { skills: { select: { skillId: true } } },
        omit: { spec: true, summary: true },
        where: { contentStatus: "completed", id: lessonId },
      });

      if (!current) {
        return false;
      }

      const planIds = await resolvePlanInputDependents(tx, {
        lessonIds: [lessonId],
        skillIds: current.skills.map(({ skillId }) => skillId),
      });

      await markPlansChanged(tx, { planIds });

      const { count } = await tx.lesson.updateMany({
        data: { contentStatus: "failed" },
        where: { contentStatus: "completed", id: lessonId },
      });

      if (count === 0) {
        throw new LessonPullLostError();
      }

      return true;
    }),
  );

  if (error instanceof LessonPullLostError) {
    return false;
  }

  if (error) {
    throw error;
  }

  if (pulled) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return pulled;
}
