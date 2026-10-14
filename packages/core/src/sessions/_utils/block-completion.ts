import "server-only";
import { awardMilestones } from "../../milestones/award-milestones";
import { type BrainPowerReward } from "../../milestones/milestone-reward";
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

/** Replays only the award stage, using evidence kept atomically with each paid reward. */
export function completeBlockMilestones({
  fullMealReward,
  payload,
  reward,
  userId,
}: {
  fullMealReward: BrainPowerReward | null;
  payload: BlockPayload;
  reward: BlockPayload["milestoneReward"];
  userId: string;
}) {
  return awardMilestones({
    badges: reward?.bossWon && payload.planItemId ? [getTrapHunterBadge(payload.planItemId)] : [],
    brainPower: reward?.brainPower ?? null,
    brainPowerRewards: fullMealReward ? [fullMealReward] : [],
    userId,
  });
}

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
  const settled = await settleSessionDay({ sessionId, source, timeZone, userId });
  const bonus = getMissionBonus(settled.missions);
  const fullMeal = settled.fullMealPaid ? bonus : 0;

  const bossWon =
    result.checkpoint && result.checkpoint.kind !== "weekly" && result.checkpoint.passed;

  const milestones = await completeBlockMilestones({
    fullMealReward: settled.fullMealReward,
    payload,
    reward: payload.milestoneReward ?? {
      bossWon: Boolean(bossWon),
      brainPower: { after: brainPowerBefore + result.brainPower, before: brainPowerBefore },
    },
    userId,
  });

  const blocks = settled.session.blocks;

  return {
    ...result,
    blockId,
    brainPower: result.brainPower + fullMeal,
    fullMeal: { bonus, paid: settled.fullMealPaid },
    milestones,
    missions: settled.missions,
    nextBlockId: getNextBlockId(blocks),
    sessionBar: getSessionBar(blocks),
    sessionCompleted: settled.sessionCompleted,
  };
}
