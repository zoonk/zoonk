import "server-only";
import { type ProgressChange } from "../sessions/_utils/session-progress";
import { serializeMilestone } from "../sessions/completion-contract";
import { type ProgressCelebration } from "../sessions/progress-celebration";
import { NOTHING_REACHED, getReached } from "../sessions/reached";
import { awardMilestones } from "./award-milestones";
import { loadCeremony } from "./load-ceremony";
import { type BrainPowerReward } from "./milestone-reward";

type DaySettlement = { fullMealPaid: boolean; fullMealReward: BrainPowerReward | null };

/** Award earned belts before settling the day so a settlement failure cannot lose them; null progress reaches nothing. */
export async function celebrateProgress({
  progress,
  settleDay,
  userId,
}: {
  progress: { brainPower: ProgressChange; energy: ProgressChange } | null;
  settleDay?: () => Promise<DaySettlement>;
  userId: string;
}): Promise<ProgressCelebration> {
  if (progress) {
    await awardMilestones({ brainPower: progress.brainPower, userId });
  }

  const day = settleDay ? await settleDay() : null;
  const bonus = day?.fullMealPaid ? day.fullMealReward : null;
  const ceremony = await loadCeremony(userId);

  const reached = progress
    ? getReached({
        brainPower: {
          after: Math.max(progress.brainPower.after, bonus?.after ?? 0),
          before: progress.brainPower.before,
        },
        energy: progress.energy,
      })
    : NOTHING_REACHED;

  return { ceremony: ceremony ? serializeMilestone(ceremony) : null, reached };
}
