import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { isDayAwaitingOutlines } from "./outlining-stand-ins";

/** The version of the goal's plan a day is built from; null for a goal without a plan. */
async function loadPlanVersion({
  client,
  goalId,
}: {
  client: TransactionClient;
  goalId: string;
}): Promise<number | null> {
  const plan = await client.plan.findUnique({ select: { version: true }, where: { goalId } });
  return plan?.version ?? null;
}

/** What a day still waiting on outlines records instead of its plan's version (see below). */
const AWAITING_OUTLINES_VERSION = 0;

/**
 * The plan version a day records once built or refreshed: the plan's, so the day isn't read
 * again until the plan changes; or, while it holds time for lessons still being outlined
 * (`isDayAwaitingOutlines`), one older than any plan's, so every read checks it again until they
 * land or nobody is writing them anymore, and the day fills up then.
 */
export async function loadDayPlanVersion({
  client = prisma,
  goal,
  localDate,
}: {
  client?: TransactionClient;
  goal: Goal;
  localDate: Date;
}): Promise<number | null> {
  const [planVersion, awaiting] = await Promise.all([
    loadPlanVersion({ client, goalId: goal.id }),
    isDayAwaitingOutlines({ client, goal, localDate }),
  ]);

  return planVersion !== null && awaiting ? AWAITING_OUTLINES_VERSION : planVersion;
}
