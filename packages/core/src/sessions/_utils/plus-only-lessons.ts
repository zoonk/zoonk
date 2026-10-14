import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { io } from "next/cache";
import { getEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { getExamPrepAccess as getPlanExamPrep } from "../../entitlements/limits";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { loadStartedLessonIds } from "../../lesson-player/_utils/lesson-runs";
import { type ExamPrepAccess, getExamPrepAccess } from "./exam-access";

type AccessGoal = Pick<Goal, "createdAt" | "kind" | "timezone">;

/**
 * What exam prep the signed-in learner's plan covers on a goal's day (`today`, the learner's
 * local date; now by default). The plan comes from the session, never from the caller.
 */
export async function loadExamPrepAccess({
  goal,
  timeZone,
  today,
}: {
  goal: AccessGoal;
  timeZone?: string | null;
  today?: Date;
}): Promise<ExamPrepAccess> {
  const viewer = goal.kind === "exam" ? await getEntitlementViewer() : null;
  const zone = getAnswerTimeZone({ goal, timeZone });

  await io();

  return getExamPrepAccess({
    examPrep: viewer ? getPlanExamPrep(viewer.tier) : null,
    goal,
    timeZone: zone,
    today: today ?? getDateInTimeZone({ date: new Date(), timeZone: zone }),
  });
}

/**
 * The lessons among `lessonIds` the goal's plan holds for Plus: on a free exam plan past its first
 * week (`access.trialEnded`), the plan's lessons still to do, by their own item or their chapter's,
 * that the learner never started. Lessons done (a replay), begun during the free week or outside
 * the plan stay open, as reviews and fixing mistakes do.
 */
export async function loadPlusOnlyLessonIds({
  access,
  goalId,
  lessonIds,
  userId,
}: {
  access: ExamPrepAccess;
  goalId: string;
  lessonIds: readonly string[];
  userId: string;
}): Promise<Set<string>> {
  if (!access.trialEnded || lessonIds.length === 0) {
    return new Set();
  }

  const ids = [...lessonIds];

  const [items, started] = await Promise.all([
    prisma.planItem.findMany({
      select: {
        chapter: {
          select: { lessons: { select: { lessonId: true }, where: { lessonId: { in: ids } } } },
        },
        kind: true,
        lessonId: true,
      },
      where: {
        OR: [
          { lessonId: { in: ids } },
          { chapter: { lessons: { some: { lessonId: { in: ids } } } }, kind: "chapter" },
        ],
        plan: { goalId },
        status: "todo",
      },
    }),
    loadStartedLessonIds({ lessonIds: ids, userId }),
  ]);

  const held = items.flatMap((item) =>
    item.kind === "chapter"
      ? (item.chapter?.lessons.map((lesson) => lesson.lessonId) ?? [])
      : (item.lessonId ?? []),
  );

  return new Set(held.filter((lessonId) => !started.has(lessonId)));
}

/**
 * Whether the learner's active goal holds this lesson for Plus now (see `loadPlusOnlyLessonIds`),
 * so opening or writing it offers Plus instead.
 */
export async function isLessonPlusOnly({
  lessonId,
  timeZone,
  userId,
}: {
  lessonId: string;
  timeZone?: string | null;
  userId: string;
}): Promise<boolean> {
  const goalId = await findActiveGoalId(userId);

  const goal = goalId
    ? await prisma.goal.findUnique({
        select: { createdAt: true, id: true, kind: true, timezone: true },
        where: { id: goalId },
      })
    : null;

  if (goal?.kind !== "exam") {
    return false;
  }

  const held = await loadPlusOnlyLessonIds({
    access: await loadExamPrepAccess({ goal, timeZone }),
    goalId: goal.id,
    lessonIds: [lessonId],
    userId,
  });

  return held.has(lessonId);
}
