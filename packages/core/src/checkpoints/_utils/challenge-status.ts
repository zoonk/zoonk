import { type PlanItem, type StudySessionBlock } from "@zoonk/db";
import { type ChallengeStatus } from "../challenge-contract";

export function getChallengeStatus({
  due,
  itemStatus,
  plusRequired,
  todayBlockStatus,
}: {
  due: boolean;
  itemStatus: PlanItem["status"];
  plusRequired: boolean;
  todayBlockStatus: StudySessionBlock["status"] | null;
}): ChallengeStatus {
  if (itemStatus !== "todo") {
    return "done";
  }

  if (plusRequired) {
    return "plusRequired";
  }

  if (todayBlockStatus === "active") {
    return "started";
  }

  if (todayBlockStatus === "pending") {
    return "ready";
  }

  if (todayBlockStatus === "completed") {
    return "tried";
  }

  return due ? "waiting" : "upcoming";
}
