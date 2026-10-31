import { type ActivityCheck } from "@zoonk/core/library/activities/schemas";
import { type ActivityPhase } from "../activity-renderer";

/** A total the question may ask for waits for the check; an interaction check's total is part of the activity. */
export function hidesAskedTotal({
  check,
  phase,
}: {
  check: Pick<ActivityCheck, "kind">;
  phase: ActivityPhase;
}): boolean {
  return check.kind !== "interaction" && phase === "answering";
}
