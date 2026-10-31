import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { isDayAwaitingOutlines } from "./outlining-stand-ins";

export const AWAITING_OUTLINES_VERSION = 0;

/** Pending outlines use an older-than-real version so Open/Continue rechecks until new lessons land or writing stops. */
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
