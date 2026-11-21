import "server-only";
import { findGoalFor, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { PlanConflictError } from "../../plans/plan-conflict";
import { announceLevelTestPlacement } from "./_utils/level-test-placement";
import { readLevelTestProgress } from "./_utils/level-test-state";
import { announceLevelTestOutSkips } from "./finish-language-level-test-out";
import { readLevelTestAttempts } from "./read-level-test-summary";

/** Workflow capability for the goal and learner recorded by the finish transaction. */
export async function announcePendingLevelTestSkips(input: { goalId: string; userId: string }) {
  const owned = await findGoalFor(input);

  if (owned.status !== "ready" || owned.goal.kind !== "language") {
    return;
  }

  const { goal } = owned;
  const timeZone = getAnswerTimeZone({ goal });
  const { attempt, testOut } = readLevelTestAttempts(goal);
  const progress = attempt ?? readLevelTestProgress(goal);

  const finished = progress.placement
    ? await announceLevelTestPlacement({
        attemptId: progress.attemptId,
        goal,
        placement: progress.placement,
        timeZone,
      })
    : true;

  const testedOut = testOut
    ? await announceLevelTestOutSkips({ goalId: goal.id, progress: testOut, timeZone })
    : true;

  if (!finished || !testedOut) {
    throw new PlanConflictError();
  }
}
