import "server-only";
import { awardMilestones } from "../../milestones/award-milestones";
import { getTrapHunterBadge, pickCeremony } from "../../milestones/milestone-rules";
import { type BlockPayload } from "../block-payload";
import { type StudyBlockCompletion } from "../completion-contract";
import { getMissionBonus } from "../missions";
import { type MissionCompletionSource } from "../missions/settle-missions";
import { type Reached, getEnergyReached, getLevelReached } from "../reached";
import { type ProgressChange } from "./session-progress";
import { getNextBlockId, getSessionBar } from "./session-view";
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

/** Nothing new reached: a block read back after an earlier request settled it. */
const NOTHING_REACHED: Reached = { energy: null, level: null };

/**
 * Settles the day after a block finished (full meal, session completion), awards milestones from
 * the Brain Power crossed and a boss won, and builds the block's completion moment. The level and
 * the tenth of Energy it reached are said by the request that settled its answers, as its
 * ceremony is: a retry returns the same missions without celebrating them again.
 */
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
  /** The learner's Brain Power total before this block's points, to find belts crossed. */
  brainPowerBefore: number;
  /**
   * Energy before and after the block's answers when this request settled them, to tell the tenth
   * they reached; null when it reads back a block an earlier request settled.
   */
  energy: ProgressChange | null;
  payload: BlockPayload;
  result: BlockResult;
  sessionId: string;
  /** The activity that finished the block, when its own screen says what it did to the missions. */
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

  // A settled block keeps the reward it paid, so a retry awards from the same evidence.
  const reward = payload.milestoneReward ?? {
    bossWon: Boolean(bossWon),
    brainPower: { after: brainPowerBefore + result.brainPower, before: brainPowerBefore },
  };

  const milestones = await awardMilestones({
    badges: reward.bossWon && payload.planItemId ? [getTrapHunterBadge(payload.planItemId)] : [],
    brainPower: reward.brainPower,
    brainPowerRewards: settled.fullMealReward ? [settled.fullMealReward] : [],
    userId,
  });

  const blocks = settled.session.blocks;

  return {
    ...result,
    blockId,
    brainPower: result.brainPower + fullMeal,
    ceremony: pickCeremony(milestones),
    completedMissions: missionResult.completed,
    fullMeal: { bonus, paid: missionResult.fullMealPaid },
    milestones,
    missions: settled.missions,
    nextBlockId: getNextBlockId(blocks),
    reached: energy
      ? {
          energy: getEnergyReached(energy),
          level: getLevelReached({
            after: reward.brainPower.after + fullMeal,
            before: reward.brainPower.before,
          }),
        }
      : NOTHING_REACHED,
    sessionBar: getSessionBar(blocks),
    sessionCompleted: settled.sessionCompleted,
  };
}
