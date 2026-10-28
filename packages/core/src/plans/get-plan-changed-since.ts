import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { type PlanWatch } from "./plan-changed-since-contract";

/** Lessons are written on another server, whose clock can run a little behind this one. */
const CLOCK_MARGIN_MS = 2000;

const SESSION_DAYS = 2;

export type PlanChangedSinceResult =
  | { changed: boolean; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/** `since` is the screen's read time in epoch milliseconds. Uncached: screens poll it. */
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
