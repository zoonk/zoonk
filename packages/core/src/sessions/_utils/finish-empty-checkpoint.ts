import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { readBlockPayload } from "../block-payload";
import { type FinishStudyBlockResult } from "../finish-study-block";
import { getMissionBonus } from "../missions";
import { pausedBlockTiming } from "./block-timing";
import { getNextBlockId, getSessionBar } from "./session-view";
import { settleSessionDay } from "./settle-session-day";
import { type StudySessionRow } from "./study-session-access";

/** A duplicate abandonment rolls back the learner mark taken before its block transition. */
class EmptyCheckpointUnchangedError extends Error {
  override name = "EmptyCheckpointUnchangedError";
}

/** A started duel with nothing left to ask ends without judging or rewarding an empty attempt. */
export async function finishEmptyCheckpoint({
  block,
  session,
  timeZone,
  userId,
}: {
  block: StudySessionBlock;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}): Promise<FinishStudyBlockResult> {
  const payload = readBlockPayload(block);
  const now = new Date();

  if (!payload.checkpointAbandoned) {
    const { error } = await safeAsync(() =>
      prisma.$transaction(async (tx) => {
        await markLearnerChanged(tx, { planInputs: true, userId });

        const { count } = await tx.studySessionBlock.updateMany({
          data: {
            completedAt: now,
            payload: {
              ...payload,
              checkpointAbandoned: true,
              timing: pausedBlockTiming({ block, now }),
            },
            status: "skipped",
          },
          where: { id: block.id, status: "active" },
        });

        if (count === 0) {
          throw new EmptyCheckpointUnchangedError("The empty checkpoint was already settled");
        }
      }),
    );

    if (error instanceof EmptyCheckpointUnchangedError) {
      return { status: "blockFinished" };
    }

    if (error) {
      throw error;
    }
  }

  const settled = await settleSessionDay({
    rewardMissions: false,
    sessionId: session.id,
    timeZone,
    userId,
  });

  const blocks = settled.session.blocks;

  return {
    completion: {
      blockId: block.id,
      brainPower: 0,
      capsulesOpened: 0,
      ceremony: null,
      checkpoint: null,
      comesBackOn: null,
      completedMissions: settled.missionResult.completed,
      correct: 0,
      fullMeal: { bonus: getMissionBonus(settled.missions), paid: false },
      milestones: [],
      missions: settled.missions,
      netScore: null,
      nextBlockId: getNextBlockId(blocks),
      reached: { energy: null, level: null },
      sessionBar: getSessionBar(blocks),
      sessionCompleted: settled.sessionCompleted,
      testOutOffer: null,
      topHyperdrive: 0,
      total: 0,
    },
    status: "ready",
  };
}
