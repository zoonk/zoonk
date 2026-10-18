import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";

export type GoalGenerationIdResult =
  | { generationId: string | null; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/**
 * The run writing the signed-in learner's goal's curriculum (or quick explanation), for a wait that
 * opened without it: one column of their own goal, never the goal's whole view. `generationId` is
 * null until a run is saved on the goal. Uncached: a wait asks for it again until it's there.
 */
export async function getGoalGenerationId({
  goalId,
}: {
  goalId: string;
}): Promise<GoalGenerationIdResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(goalId)) {
    return { status: "notFound" };
  }

  const goal = await prisma.goal.findFirst({
    select: { generationRunId: true },
    where: { id: goalId, userId: session.user.id },
  });

  return goal ? { generationId: goal.generationRunId, status: "ready" } : { status: "notFound" };
}
