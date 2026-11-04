import "server-only";
import { type GoalCreateResult, createGoals, getNewGoalToday } from "../../goals/create-goals";
import { type GoalCreateInput } from "../../goals/goal-contract";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { readDetail } from "./_utils/onboarding-goals";
import { withPlannableDate } from "./_utils/understanding-view";

/**
 * A card's date can stop being ahead after the card was read (past midnight, or confirmed in
 * another zone), so it's read again here as the card reads it; a date no card gave is checked as
 * sent.
 */
function withCardDates(input: GoalCreateInput): GoalCreateInput {
  const today = getNewGoalToday(input.timeZone);

  return {
    ...input,
    goals: input.goals.map((goal) =>
      readDetail(goal.details, "onboardingId") ? withPlannableDate({ draft: goal, today }) : goal,
    ),
  };
}

/** Requires sign-in; links only owned unattached sources and defers memory until age and onboarding answers are known. */
export async function createOnboardingGoals(input: GoalCreateInput): Promise<GoalCreateResult> {
  const result = await createGoals(withCardDates(input));
  const [main] = result.status === "created" ? result.goals : [];

  if (main && input.sourceIds?.length) {
    const session = await getSession();

    if (session) {
      await writeLearnerChange({ userId: session.user.id }, async (tx) => {
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
