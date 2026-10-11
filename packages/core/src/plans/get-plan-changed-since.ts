import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { type PlanWatch } from "./plan-changed-since-contract";

/**
 * Lessons are written on another server, whose clock can run a little behind this one: a change
 * this long before the screen's read still counts, so it's never missed (an extra read at worst).
 */
const CLOCK_MARGIN_MS = 2000;

/** The sessions Today can be showing: the day's, or one carried over from the day before. */
const SESSION_DAYS = 2;

export type PlanChangedSinceResult =
  | { changed: boolean; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/**
 * Whether what Today and the Journey show while lessons are being written changed since they read
 * it (`since`, milliseconds since the epoch: the screen's read time): the goal's plan (a re-plan
 * brings in the lessons the Library wrote), one of its items or an item's lesson, and, watching
 * `today` (the Journey shows only the plan), a recent session, one of its stops or a stop's lesson.
 * A screen waiting on lessons asks this every few seconds and reads itself again only when it says
 * so, instead of reading everything each time. Never cached: it's the poll.
 */
export async function getPlanChangedSince({
  goalId,
  since,
  watch,
}: {
  goalId: string;
  since: number;
  watch: PlanWatch;
}): Promise<PlanChangedSinceResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const after = { gt: new Date(since - CLOCK_MARGIN_MS) };
  const changedLesson = { lesson: { updatedAt: after } };

  const [plans, sessions] = await Promise.all([
    prisma.plan.count({
      where: {
        OR: [
          { updatedAt: after },
          { items: { some: { OR: [{ updatedAt: after }, changedLesson] } } },
        ],
        goalId,
      },
    }),
    watch === "today"
      ? prisma.studySession.count({
          where: {
            OR: [
              { updatedAt: after },
              { blocks: { some: { OR: [{ updatedAt: after }, changedLesson] } } },
            ],
            goalId,
            localDate: { gte: new Date(since - SESSION_DAYS * MS_PER_DAY) },
            userId: owned.userId,
          },
        })
      : 0,
  ]);

  return { changed: plans + sessions > 0, status: "ready" };
}
