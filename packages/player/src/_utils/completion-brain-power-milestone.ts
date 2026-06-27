import { type CompletionProgress, type PlayerProgressSnapshot } from "../completion-milestones";

export type BrainPowerCompletionMilestone = {
  brainPower: number;
  kind: "brainPower";
  status: "dailyRecord";
};

/**
 * Daily Brain Power records should fire once per day: the first completion that
 * beats every previous day's BP earns the milestone, but later lessons on the
 * same already-record-setting day stay quiet.
 */
export function getDailyBrainPowerRecordMilestone({
  completion,
  progressSnapshot,
}: {
  completion: CompletionProgress;
  progressSnapshot: PlayerProgressSnapshot | null;
}): BrainPowerCompletionMilestone | null {
  if (
    !progressSnapshot ||
    completion.brainPower <= 0 ||
    progressSnapshot.highestPreviousDailyBrainPower <= 0
  ) {
    return null;
  }

  const newTodayBrainPower = progressSnapshot.todayBrainPower + completion.brainPower;

  if (
    progressSnapshot.todayBrainPower > progressSnapshot.highestPreviousDailyBrainPower ||
    newTodayBrainPower <= progressSnapshot.highestPreviousDailyBrainPower
  ) {
    return null;
  }

  return { brainPower: newTodayBrainPower, kind: "brainPower", status: "dailyRecord" };
}
