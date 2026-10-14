import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { readBlockPayload } from "../block-payload";
import { type FinishStudyBlockResult } from "../finish-study-block";
import { getMissionBonus } from "../missions";
import { pausedBlockTiming } from "./block-timing";
import { getNextBlockId, getSessionBar } from "./session-view";
import { settleSessionDay } from "./settle-session-day";
import { type StudySessionRow } from "./study-session-access";

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
    const { count } = await prisma.studySessionBlock.updateMany({
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
      return { status: "blockFinished" };
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
      checkpoint: null,
      comesBackOn: null,
      correct: 0,
      fullMeal: { bonus: getMissionBonus(settled.missions), paid: false },
      milestones: [],
      missions: settled.missions,
      netScore: null,
      nextBlockId: getNextBlockId(blocks),
      sessionBar: getSessionBar(blocks),
      sessionCompleted: settled.sessionCompleted,
      testOutOffer: null,
      topHyperdrive: 0,
      total: 0,
    },
    status: "ready",
  };
}
