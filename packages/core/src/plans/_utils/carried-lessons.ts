import "server-only";
import { prisma } from "@zoonk/db";
import { type CarryOver } from "../planner/carry-over";

/**
 * What the learner's last study day before today gave them and they didn't finish: its session's
 * lessons not done yet, in the session's order. Today's session isn't read, since a change made
 * today re-plans it as it is (see `followPlanChangeToday`).
 */
export async function loadCarryOver({
  goalId,
  today,
}: {
  goalId: string;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): Promise<CarryOver> {
  const session = await prisma.studySession.findFirst({
    include: {
      blocks: {
        orderBy: { position: "asc" },
        where: { kind: "learn", lessonId: { not: null }, status: { in: ["pending", "active"] } },
      },
    },
    orderBy: { localDate: "desc" },
    where: { goalId, localDate: { lt: today } },
  });

  return { lessonIds: session?.blocks.flatMap((block) => block.lessonId ?? []) ?? [] };
}

/**
 * Whether the learner was already shown today: its session was built with blocks. Lessons landing
 * then don't grow the day past the time it holds for them (see `placeLandedThisWeek`).
 */
export async function isTodayShown({
  goalId,
  today,
}: {
  goalId: string;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): Promise<boolean> {
  const session = await prisma.studySession.findFirst({
    select: { id: true },
    where: { blocks: { some: {} }, goalId, localDate: today },
  });

  return session !== null;
}
