import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import {
  isTimeZoneUnchanged,
  moveGoalTimeZoneInTransaction,
} from "../../learner/follow-goal-time-zone";

/** Zone following is a separate marked POST phase, before the request selects its one plan. */
export async function followOpenDayZone({
  goal,
  timeZone,
  userId,
}: {
  goal: Goal;
  timeZone?: string;
  userId: string;
}): Promise<{ goal: Goal; status: "ready" } | { status: "retryable" }> {
  if (!timeZone || timeZone === goal.timezone) {
    return { goal, status: "ready" };
  }

  try {
    const current = await prisma.$transaction(async (tx) => {
      await moveGoalTimeZoneInTransaction(tx, {
        fromZone: goal.timezone,
        goalId: goal.id,
        toZone: timeZone,
        userId,
      });

      return tx.goal.findFirstOrThrow({ where: { id: goal.id, userId } });
    });

    return { goal: current, status: "ready" };
  } catch (error) {
    if (!isTimeZoneUnchanged(error)) {
      throw error;
    }

    if (error.reason !== "studied") {
      return { status: "retryable" };
    }

    const current = await prisma.goal.findFirst({ where: { id: goal.id, userId } });
    return current ? { goal: current, status: "ready" } : { status: "retryable" };
  }
}
