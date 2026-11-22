import "server-only";
import { type GoalCreateResult, createGoals } from "../../goals/create-goals";
import { type GoalCreateInput } from "../../goals/goal-contract";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";

/** Requires sign-in; links only owned unattached sources and defers memory until age and onboarding answers are known. */
export async function createOnboardingGoals(input: GoalCreateInput): Promise<GoalCreateResult> {
  const result = await createGoals(input);
  const [main] = result.status === "created" ? result.goals : [];

  if (main && input.sourceIds?.length) {
    const session = await getSession();

    if (session) {
      // Material sent with the request fills a goal only when its card kept none.
      await writeLearnerChange({ userId: session.user.id }, async (tx) => {
        const kept = await tx.learnerSource.count({ where: { goalId: main.id } });

        if (kept > 0) {
          return unchanged(null);
        }

        const { count } = await tx.learnerSource.updateMany({
          data: { goalId: main.id },
          where: { goalId: null, sourceId: { in: input.sourceIds }, userId: session.user.id },
        });

        return count === 0 ? unchanged(null) : null;
      });
    }
  }

  return result;
}
