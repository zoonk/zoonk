import "server-only";
import { prisma } from "@zoonk/db";
import { canStartUsage } from "../../entitlements/_utils/check-usage";
import { getEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { loadPendingBlockMistakes } from "../../mistakes/_utils/practice-block";
import { type BlockPayload, readBlockPayload } from "../block-payload";
import { type FinishStudyBlockResult } from "../finish-study-block";
import { oweDaySettlement } from "../settle-owed-session-day";
import { completeBlockMoment } from "./block-completion";
import { pausedBlockTiming } from "./block-timing";
import { type StudySessionRow } from "./study-session-access";

async function hasSpokenAllowance(): Promise<boolean> {
  const viewer = await getEntitlementViewer();

  return viewer ? canStartUsage({ kind: "assist", now: new Date(), viewer }) : false;
}

export async function finishMistakeBlock({
  block,
  payload,
  session,
  timeZone,
  userId,
}: {
  block: StudySessionRow["blocks"][number];
  payload: BlockPayload;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}): Promise<FinishStudyBlockResult> {
  if (block.status === "skipped") {
    return { status: "blockFinished" };
  }

  if (block.status !== "completed") {
    const { replays } = await loadPendingBlockMistakes({
      mistakeIds: payload.mistakeIds,
      now: new Date(),
      timeZone,
      userId,
    });

    const pending = [...replays.values()].filter((replay) => replay !== null);

    if (
      pending.some(
        (replay) => replay.kind !== "lesson" || replay.lesson.step.kind !== "spokenAnswer",
      ) ||
      (pending.length > 0 && (await hasSpokenAllowance()))
    ) {
      return { status: "unanswered" };
    }

    const completed = await writeLearnerChange({ planInputs: true, userId }, async (tx) => {
      const now = new Date();
      const current = await tx.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });

      const { count } = await tx.studySessionBlock.updateMany({
        data: {
          completedAt: now,
          payload: {
            ...readBlockPayload(current),
            timing: pausedBlockTiming({ block: current, now }),
          },
          status: "completed",
        },
        where: { id: block.id, status: { in: ["active", "pending"] } },
      });

      if (count === 0) {
        return unchanged(current.status === "completed");
      }

      await oweDaySettlement(tx, { block, timeZone, userId });
      return true;
    });

    if (!completed) {
      return { status: "blockFinished" };
    }
  }

  const progress = await prisma.userProgress.findUnique({
    select: { totalBrainPower: true },
    where: { userId },
  });

  // The notebook run already paid its answer rewards as it went.
  const completion = await completeBlockMoment({
    blockId: block.id,
    brainPowerBefore: Number(progress?.totalBrainPower ?? 0),
    energy: null,
    payload,
    result: {
      brainPower: 0,
      capsulesOpened: 0,
      checkpoint: null,
      correct: 0,
      finishedChapter: null,
      netScore: null,
      reminderOffer: null,
      testOutOffer: null,
      topHyperdrive: 0,
      total: 0,
    },
    sessionId: session.id,
    timeZone,
    userId,
  });

  return { completion, status: "ready" };
}
