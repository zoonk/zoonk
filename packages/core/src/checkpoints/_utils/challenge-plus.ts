import "server-only";
import { loadExamPrepAccess } from "../../sessions/_utils/plus-only-lessons";
import { type OwnedChallenge } from "./owned-challenge";

/**
 * Whether the learner's plan leaves a challenge still to do to Plus: an exam's mock when mocks
 * aren't in the plan, or a phase challenge once a free exam plan's first week is over (the day's
 * session holds no challenges then). The free plan says so instead of hiding it.
 */
export async function needsPlus({ goal, item, timeZone, today }: OwnedChallenge): Promise<boolean> {
  if (item.status !== "todo" || (item.kind !== "mock" && item.kind !== "boss")) {
    return false;
  }

  const access = await loadExamPrepAccess({ goal, timeZone, today });
  return item.kind === "mock" ? !access.includesMockExams : access.trialEnded;
}
