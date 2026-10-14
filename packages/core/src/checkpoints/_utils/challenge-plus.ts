import "server-only";
import { loadExamPrepAccess } from "../../sessions/_utils/plus-only-lessons";
import { type OwnedChallenge } from "./owned-challenge";
import { arePhaseChallengesRequired } from "./phase-challenge-access";

/**
 * Whether a challenge needs Plus: a language phase's call, including another try after its
 * completed result, an exam's unfinished mock when mocks aren't in the plan, or an unfinished
 * phase challenge once a free exam plan's first week is over. Content and results stay visible.
 */
export async function needsPlus({
  goal,
  item,
  timeZone,
  today,
  userId,
}: OwnedChallenge): Promise<boolean> {
  if (goal.kind === "language" && item.kind === "boss") {
    return !(await arePhaseChallengesRequired({ goalKind: goal.kind, userId }));
  }

  if (item.status !== "todo" || (item.kind !== "mock" && item.kind !== "boss")) {
    return false;
  }

  const access = await loadExamPrepAccess({ goal, timeZone, today });
  return item.kind === "mock" ? !access.includesMockExams : access.trialEnded;
}
