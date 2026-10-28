import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { isDayAwaitingOutlines } from "./outlining-stand-ins";

/** What a day still waiting on outlines records instead of its plan's version (see below). */
export const AWAITING_OUTLINES_VERSION = 0;

/**
 * The plan version a day records once built or refreshed: the plan's; or, while it holds time for
 * lessons still being outlined (`isDayAwaitingOutlines`), one older than any plan's, so the
 * learner's next Open or Continue checks it again until they land or nobody is writing them
 * anymore, and the day fills up then (`appendLandedLessons`).
 */
export async function loadDayPlanVersion({
  client = prisma,
  goal,
  localDate,
  plan,
}: {
  client?: TransactionClient;
  goal: Goal;
  localDate: Date;
  plan?: { graph: unknown; version: number };
}): Promise<number | null> {
  const stored =
    plan ??
    (await client.plan.findUnique({
      select: { graph: true, version: true },
      where: { goalId: goal.id },
    }));

  if (!stored) {
    return null;
  }

  const awaiting = await isDayAwaitingOutlines({ client, goal, graph: stored.graph, localDate });

  return awaiting ? AWAITING_OUTLINES_VERSION : stored.version;
}
