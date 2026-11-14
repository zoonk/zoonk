import "server-only";
import { loadExamPrepAccess } from "../../sessions/_utils/load-exam-access";
import { type OwnedChallenge } from "./owned-challenge";
import { arePhaseChallengesRequired } from "./phase-challenge-access";

export async function needsPlus({ goal, item, userId }: OwnedChallenge): Promise<boolean> {
  if (goal.kind === "language" && item.kind === "boss") {
    return !(await arePhaseChallengesRequired({ goalKind: goal.kind, userId }));
  }

  if (item.status !== "todo" || (item.kind !== "mock" && item.kind !== "boss")) {
    return false;
  }

  const access = await loadExamPrepAccess({ goal });
  return item.kind === "mock" ? !access.includesMockExams : false;
}
