import "server-only";
import { prisma } from "@zoonk/db";
import { type GoalCreateResult, createGoals } from "../../goals/create-goals";
import { type GoalCreateInput } from "../../goals/goal-contract";
import { getSession } from "../../users/get-session";

/**
 * Creates the goals the learner confirmed on the "Here's what I understood" card and links the
 * material they attached to the main goal before its research and curriculum start. Goal limits,
 * the shared daily time and the active goal work as in `createGoals`. Only the learner's own
 * sources not yet tied to a goal are linked. Memory learns from onboarding once its questions are
 * answered (`answerOnboardingQuestion`): a new learner's age, which decides whether memory is on,
 * isn't known yet.
 */
export async function createOnboardingGoals(input: GoalCreateInput): Promise<GoalCreateResult> {
  const result = await createGoals(input);
  const [main] = result.status === "created" ? result.goals : [];

  if (main && input.sourceIds?.length) {
    const session = await getSession();

    if (session) {
      await prisma.learnerSource.updateMany({
        data: { goalId: main.id },
        where: { goalId: null, sourceId: { in: input.sourceIds }, userId: session.user.id },
      });
    }
  }

  return result;
}
