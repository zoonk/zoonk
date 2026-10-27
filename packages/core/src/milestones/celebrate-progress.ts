import "server-only";
import { type ProgressChange } from "../sessions/_utils/session-progress";
import { serializeMilestone } from "../sessions/completion-contract";
import { type ProgressCelebration } from "../sessions/progress-celebration";
import { NOTHING_REACHED, getReached } from "../sessions/reached";
import { awardMilestones } from "./award-milestones";
import { loadCeremony } from "./load-ceremony";
import { type BrainPowerReward } from "./milestone-reward";

/** What settling the day's missions after the work paid: the day's bonus, when it was the last. */
type DaySettlement = { fullMealPaid: boolean; fullMealReward: BrainPowerReward | null };

/**
 * Records the belts and buddy stages the work's Brain Power crossed, like a session block's, then
 * settles the day it counts toward (`settleDay`: the missions it completed), and says what its
 * result celebrates: the level and the tenth of Energy it reached, the day's bonus it paid
 * included, as a block's level is, and the milestone not shown yet. The belts come first, right
 * after the work was saved, so a day that fails to settle never loses them. `progress` is null when
 * nothing was added (a repeat), which reaches nothing.
 */
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
