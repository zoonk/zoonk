import "server-only";
import { loadUnshownCertificates } from "../../certificates/_utils/unshown-certificates";
import { awardMilestones } from "../../milestones/award-milestones";
import { loadCeremony } from "../../milestones/load-ceremony";
import { getTrapHunterBadge } from "../../milestones/milestone-rules";
import { type BlockPayload } from "../block-payload";
import { type StudyBlockCompletion } from "../completion-contract";
import { getMissionBonus } from "../missions";
import { type MissionCompletionSource } from "../missions/settle-missions";
import { NOTHING_REACHED, getReached } from "../reached";
import { loadCompletionQueue } from "./completion-queue";
import { type ProgressChange } from "./session-progress";
import { settleSessionDay } from "./settle-session-day";

type BlockResult = Pick<
  StudyBlockCompletion,
  | "brainPower"
  | "capsulesOpened"
  | "checkpoint"
  | "comesBackOn"
  | "correct"
  | "netScore"
  | "testOutOffer"
  | "topHyperdrive"
  | "total"
>;

type MilestoneReward = NonNullable<BlockPayload["milestoneReward"]>;

export function getBlockMilestoneAwards({
  payload,
  reward,
}: {
  payload: BlockPayload;
  reward: MilestoneReward;
}): Pick<Parameters<typeof awardMilestones>[0], "badges" | "brainPower"> {
  return {
    badges: reward.bossWon && payload.planItemId ? [getTrapHunterBadge(payload.planItemId)] : [],
    brainPower: reward.brainPower,
  };
}

/** Retries replay missions without celebrating the same answer rewards again. */
export async function completeBlockMoment({
  blockId,
  brainPowerBefore,
  energy,
  payload,
  result,
  sessionId,
  source,
  timeZone,
  userId,
}: {
  blockId: string;
  brainPowerBefore: number;
  /** Null when an earlier request already settled the answers. */
  energy: ProgressChange | null;
  payload: BlockPayload;
  result: BlockResult;
  sessionId: string;
  source?: MissionCompletionSource;
  timeZone: string;
  userId: string;
}): Promise<StudyBlockCompletion> {
  const settled = await settleSessionDay({ blockId, sessionId, source, timeZone, userId });
  const { missionResult } = settled;
  const bonus = getMissionBonus(settled.missions);
  const fullMeal = missionResult.fullMealPaid ? bonus : 0;

  const bossWon =
    result.checkpoint && result.checkpoint.kind !== "weekly" && result.checkpoint.passed;

  // Retries must award milestones from the original paid reward evidence.
  const reward = payload.milestoneReward ?? {
    bossWon: Boolean(bossWon),
    brainPower: { after: brainPowerBefore + result.brainPower, before: brainPowerBefore },
  };

  // The completion carries the settled queue, so its next step and aside never depend on an earlier lesson prefetch.
  const [milestones, queue] = await Promise.all([
    awardMilestones({
      ...getBlockMilestoneAwards({ payload, reward }),
      brainPowerRewards: settled.fullMealReward ? [settled.fullMealReward] : [],
      userId,
    }),
    loadCompletionQueue({ blockId, sessionId, timeZone, userId }),
  ]);

  const [ceremony, certificates] = await Promise.all([
    loadCeremony(userId),
    loadUnshownCertificates(userId),
  ]);

  return {
    ...queue,
    ...result,
    blockId,
    brainPower: result.brainPower + fullMeal,
    ceremony,
    certificates,
    completedMissions: missionResult.completed,
    fullMeal: { bonus, paid: missionResult.fullMealPaid },
    milestones,
    missions: settled.missions,
    reached: energy
      ? getReached({
          brainPower: {
            after: reward.brainPower.after + fullMeal,
            before: reward.brainPower.before,
          },
          energy,
        })
      : NOTHING_REACHED,
  };
}
