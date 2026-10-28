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
import { type SessionPlanItem } from "./session-plan-item";

type AccessGoal = Pick<Goal, "createdAt" | "kind" | "timezone">;

/** Tier comes from the session; today is a learner-local label, defaulting to the current day. */
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

/** Already-started, completed, and unplanned lessons stay open after free exam coverage ends. */
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

export type PlusLesson = { title: string };

type DayItem = Pick<
  SessionPlanItem,
  "kind" | "lessonId" | "scheduledFor" | "status" | "titleSnapshot"
>;

/** Unopened days may pass unsaved selected items; preserve locked lessons in display instead of silently shortening the day. */
export async function loadDayPlusLessons({
  access,
  goalId,
  items,
  localDate,
  userId,
}: {
  access: ExamPrepAccess;
  goalId: string | null;
  items?: readonly DayItem[];
  localDate: Date;
  userId: string;
}): Promise<PlusLesson[]> {
  if (!access.trialEnded || !goalId) {
    return [];
  }

  const planned =
    items ??
    (await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      select: { kind: true, lessonId: true, scheduledFor: true, status: true, titleSnapshot: true },
      where: { plan: { goalId }, scheduledFor: localDate },
    }));

  const today = planned.filter(
    (item) =>
      item.status === "todo" &&
      (item.kind === "lesson" || item.kind === "chapter") &&
      item.scheduledFor?.getTime() === localDate.getTime(),
  );

  const started = await loadStartedLessonIds({
    lessonIds: today.flatMap((item) => item.lessonId ?? []),
    userId,
  });

  return today
    .filter((item) => !item.lessonId || !started.has(item.lessonId))
    .map((item) => ({ title: item.titleSnapshot }));
}

/** Uses the active goal's current entitlement, not an arbitrary plan containing the lesson. */
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
