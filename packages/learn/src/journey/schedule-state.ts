import { type PlanStatus } from "../plan/plan-status-label";

export function showsResumeSchedule({
  paused,
  status,
}: {
  paused: boolean;
  status: PlanStatus;
}): boolean {
  return (
    paused &&
    status.kind !== "pastDate" &&
    status.kind !== "finished" &&
    status.kind !== "challengesLeft"
  );
}
