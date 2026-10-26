import "server-only";
import { awardMilestones } from "../../milestones/award-milestones";
import { getTrapHunterBadge } from "../../milestones/milestone-rules";
import { type BlockPayload } from "../block-payload";
import { type StudyBlockCompletion } from "../completion-contract";
import { getMissionBonus } from "../missions";
import { type MissionCompletionSource } from "../missions/settle-missions";
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

/**
 * Settles the day after a block finished (full meal, session completion), awards milestones from
 * the Brain Power crossed and a boss won, and builds the block's completion moment.
 */
export async function completeBlockMoment({
  blockId,
  brainPowerBefore,
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
    completedMissions: missionResult.completed,
    fullMeal: { bonus, paid: missionResult.fullMealPaid },
    milestones,
    missions: settled.missions,
    nextBlockId: getNextBlockId(blocks),
    sessionBar: getSessionBar(blocks),
    sessionCompleted: settled.sessionCompleted,
  };
}
