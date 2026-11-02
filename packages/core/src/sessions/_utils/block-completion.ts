import "server-only";
import { awardMilestones } from "../../milestones/award-milestones";
import { getTrapHunterBadge, pickCeremony } from "../../milestones/milestone-rules";
import { type BlockPayload } from "../block-payload";
import { type StudyBlockCompletion } from "../completion-contract";
import { getMissionBonus } from "../missions";
import { type MissionCompletionSource } from "../missions/settle-missions";
import { NOTHING_REACHED, getReached } from "../reached";
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
      ? getReached({
          brainPower: {
            after: reward.brainPower.after + fullMeal,
            before: reward.brainPower.before,
          },
          energy,
        })
      : NOTHING_REACHED,
    sessionBar: getSessionBar(blocks),
    sessionCompleted: settled.sessionCompleted,
  };
}
