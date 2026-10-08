import "server-only";
import { awardMilestones } from "../../milestones/award-milestones";
import { getTrapHunterBadge } from "../../milestones/milestone-rules";
import { type BlockPayload } from "../block-payload";
import { BRAIN_POWER_BONUS } from "../brain-power";
import { type StudyBlockCompletion } from "../completion-contract";
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
  timeZone,
  userId,
}: {
  blockId: string;
  /** The learner's Brain Power total before this block's points, to find belts crossed. */
  brainPowerBefore: number;
  payload: BlockPayload;
  result: BlockResult;
  sessionId: string;
  timeZone: string;
  userId: string;
}): Promise<StudyBlockCompletion> {
  const settled = await settleSessionDay({ sessionId, timeZone, userId });
  const fullMeal = settled.fullMealPaid ? BRAIN_POWER_BONUS.fullMeal : 0;

  const bossWon =
    result.checkpoint && result.checkpoint.kind !== "weekly" && result.checkpoint.passed;

  const milestones = await awardMilestones({
    badges: bossWon && payload.planItemId ? [getTrapHunterBadge(payload.planItemId)] : [],
    brainPower: {
      after: brainPowerBefore + result.brainPower + fullMeal,
      before: brainPowerBefore,
    },
    userId,
  });

  const blocks = settled.session.blocks;

  return {
    ...result,
    blockId,
    brainPower: result.brainPower + fullMeal,
    fullMeal: { bonus: BRAIN_POWER_BONUS.fullMeal, paid: settled.fullMealPaid },
    milestones,
    missions: settled.missions,
    nextBlockId: getNextBlockId(blocks),
    sessionBar: getSessionBar(blocks),
    sessionCompleted: settled.sessionCompleted,
  };
}
