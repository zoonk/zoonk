import { isDeepStrictEqual } from "node:util";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { findActiveGoalId } from "../../../goals/_utils/goal-view";
import { hasStudyGoal } from "../../../goals/_utils/study-goal";
import { getCurrentSuggestedGoal } from "../../../goals/suggestions/get-current-suggested-goal";
import { loadViewerStamp } from "../../../learner/_utils/load-viewer-stamp";
import { type OwnedGoal, findOwnedGoal } from "../../../learner/_utils/owned-goal";
import { getSession } from "../../../users/get-session";
import { getOnboarding } from "../../onboarding/get-onboarding";
import { type TodayViewResult } from "../get-today-view";

/**
 * A goal's plan is built in the background after onboarding. Until it has items there's no day to
 * build, and building one then would fix an empty day in place: the day is built once it's ready.
 */
async function isPlanBuilt(
  goalId: string,
  client: Pick<TransactionClient, "planItem"> = prisma,
): Promise<boolean> {
  const items = await client.planItem.count({ where: { plan: { goalId } } });
  return items > 0;
}

/** Why Today shows a goal no day, in the order it asks. */
type TodayRefusal = "explainOnly" | "goalNotActive" | "onboardingAhead" | "planNotBuilt";

/**
 * Today's rules for showing a goal a day: an active goal (a paused, completed or archived one has
 * no day to plan); a quick explanation only for a learner who also has a goal to study (it's a
 * one-off otherwise); a built plan; and a guest's once onboarding is answered (a course's default
 * plan can be ready before its guest has). The facts behind the last two questions are read only
 * when asked, so admission reads what it always has.
 */
async function findTodayRefusal({
  built,
  goal,
  onboardingAhead,
  studyGoal,
}: {
  built: boolean;
  goal: Pick<Goal, "kind" | "status">;
  onboardingAhead: () => Promise<boolean>;
  studyGoal: () => Promise<boolean>;
}): Promise<TodayRefusal | null> {
  if (goal.status !== "active") {
    return "goalNotActive";
  }

  if (goal.kind === "explain" && !(await studyGoal())) {
    return "explainOnly";
  }

  if (!built) {
    return "planNotBuilt";
  }

  return (await onboardingAhead()) ? "onboardingAhead" : null;
}

/** Today's own refusal, or the learner's goal it shows a day for (`admitted`). */
export type TodayAdmission =
  | Exclude<TodayViewResult, { status: "ready" }>
  | {
      guest: boolean;
      owned: Extract<OwnedGoal, { status: "ready" }>;
      stamp: { revision: string; userId: string };
      status: "admitted";
    };

/**
 * Whether Today shows a day for the requested goal (the active one by default), under
 * `findTodayRefusal`'s rules. It writes nothing, so a refused goal stays as it was.
 */
export async function admitToday(requestedGoalId?: string): Promise<TodayAdmission> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const guest = Boolean(session.user.isAnonymous);

  const stamp = await loadViewerStamp(userId);

  const goalId = requestedGoalId ?? (await findActiveGoalId(userId));

  if (!goalId) {
    return { ...stamp, status: "noGoal", suggestedGoal: await getCurrentSuggestedGoal() };
  }

  // Whether the plan is built is read alongside the goal; it's only used once the goal is theirs.
  const [owned, built] = await Promise.all([findOwnedGoal(goalId), isPlanBuilt(goalId)]);

  if (owned.status !== "ready") {
    return owned;
  }

  const refusal = await findTodayRefusal({
    built,
    goal: owned.goal,
    onboardingAhead: async () => {
      if (!guest) {
        return false;
      }

      const onboarding = await getOnboarding({ goalId });

      return (
        onboarding.status === "ready" && onboarding.onboarding.steps.some((step) => step !== "plan")
      );
    },
    studyGoal: () => hasStudyGoal(userId),
  });

  const { id, kind, title } = owned.goal;

  if (refusal === "goalNotActive") {
    return { ...stamp, status: "goalNotActive" };
  }

  if (refusal === "explainOnly") {
    return { ...stamp, status: "noGoal", suggestedGoal: await getCurrentSuggestedGoal() };
  }

  if (refusal) {
    return { ...stamp, goal: { id, kind, title }, status: "preparing" };
  }

  return { guest, owned, stamp, status: "admitted" };
}

/**
 * Whether Today still shows the admitted goal a day, read through a follow's transaction once it
 * holds the goal's plan and learner locks: `findTodayRefusal` on the goal, its plan and the
 * learner's goals as they are now, so a writer that committed while the follow waited counts. A
 * guest's onboarding isn't rebuilt there: it still holds while what onboarding reads from the goal
 * (its details and date) is what admission saw.
 */
export async function stillAdmitted(
  tx: TransactionClient,
  admission: Extract<TodayAdmission, { status: "admitted" }>,
): Promise<boolean> {
  const { goal: admitted, userId } = admission.owned;

  // One query at a time: they share the transaction's connection.
  const goal = await tx.goal.findFirst({ where: { id: admitted.id, userId } });

  if (!goal) {
    return false;
  }

  const onboardingChanged = !isDeepStrictEqual(
    [goal.details, goal.targetDate],
    [admitted.details, admitted.targetDate],
  );

  const refusal = await findTodayRefusal({
    built: await isPlanBuilt(admitted.id, tx),
    goal,
    onboardingAhead: () => Promise.resolve(admission.guest && onboardingChanged),
    studyGoal: () => hasStudyGoal(userId, tx),
  });

  return refusal === null;
}
