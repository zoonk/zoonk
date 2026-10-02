import "server-only";
import { prisma } from "@zoonk/db";
import { type GoalCreateResult, createGoals } from "../../goals/create-goals";
import { type GoalCreateInput } from "../../goals/goal-contract";
import { scheduleMemoryUpdate } from "../../memory/update-memory-from-activity";
import { getSession } from "../../users/get-session";

/**
 * Creates the goals the learner confirmed on the "Here's what I understood" card, links the
 * material they attached to the main goal before its research and curriculum start, then learns
 * from what they said after the response is sent (memory respects "off" and minors' limits).
 * Goal limits, the shared daily time and the active goal work as in `createGoals`. Only the
 * learner's own sources not yet tied to a goal are linked.
 */
export async function createOnboardingGoals(input: GoalCreateInput): Promise<GoalCreateResult> {
  const result = await createGoals(input);
  const [main] = result.status === "created" ? result.goals : [];
  const session = main ? await getSession() : null;

  if (main && session) {
    if (input.sourceIds?.length) {
      await prisma.learnerSource.updateMany({
        data: { goalId: main.id },
        where: { goalId: null, sourceId: { in: input.sourceIds }, userId: session.user.id },
      });
    }

    scheduleMemoryUpdate({
      source: { goalId: main.id, kind: "onboarding" },
      userId: session.user.id,
    });
  }

  return result;
}
