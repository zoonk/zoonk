import { type PlanItem, type StudySessionBlock } from "@zoonk/db";
import { type ChallengeStatus } from "../challenge-contract";

/**
 * Where a challenge stands today, from its plan item and today's block for it. On its day, today's
 * session is planned before this is asked, so a due challenge without a block waits for the next
 * session. A mock the plan doesn't include needs Plus, before its day too.
 */
export function getChallengeStatus({
  due,
  itemStatus,
  plusRequired,
  todayBlockStatus,
}: {
  /** Its day came, or a phase checkpoint's lessons are done. */
  due: boolean;
  itemStatus: PlanItem["status"];
  plusRequired: boolean;
  todayBlockStatus: StudySessionBlock["status"] | null;
}): ChallengeStatus {
  if (itemStatus !== "todo") {
    return "done";
  }

  if (todayBlockStatus === "active") {
    return "started";
  }

  if (todayBlockStatus === "pending") {
    return "ready";
  }

  // Finished today and still to do: a phase checkpoint that didn't pass tries again tomorrow.
  if (todayBlockStatus === "completed") {
    return "tried";
  }

  if (plusRequired) {
    return "plusRequired";
  }

  return due ? "waiting" : "upcoming";
}
