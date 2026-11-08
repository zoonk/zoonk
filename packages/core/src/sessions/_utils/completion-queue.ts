import "server-only";
import { prisma } from "@zoonk/db";
import {
  arePhaseChallengesRequired,
  withoutLockedPhaseChallenges,
} from "../../checkpoints/_utils/phase-challenge-access";
import { loadSessionBlockViews } from "./load-session-block-views";
import { getNextBlockId, getSessionBar } from "./session-view";
import { STUDY_SESSION_INCLUDE } from "./study-session-access";

/** Read after settlement: a concurrent append must appear in both the queue and its next step. */
export async function loadCompletionQueue({
  blockId,
  sessionId,
  timeZone,
  userId,
}: {
  blockId: string;
  sessionId: string;
  timeZone: string;
  userId: string;
}) {
  const stored = await prisma.studySession.findFirstOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: sessionId, userId },
  });

  const required = stored.goal
    ? await arePhaseChallengesRequired({ goalKind: stored.goal.kind, userId })
    : true;

  const session = {
    ...stored,
    blocks: withoutLockedPhaseChallenges({
      blocks: stored.blocks,
      phaseChallengesRequired: required,
    }),
  };

  const projection = await loadSessionBlockViews({ session, timeZone, userId });
  const nextBlockId = getNextBlockId(session.blocks);
  const nextBlock = projection.blocks.find((block) => block.id === nextBlockId) ?? null;

  return {
    blocks: projection.blocks,
    finishedChapterId: projection.blocks.find((block) => block.id === blockId)?.chapterId ?? null,
    goalId: session.goalId,
    next: nextBlock
      ? {
          block: nextBlock,
          opensInPlayer: nextBlock.opensInPlayer,
          target: { blockId: nextBlock.id, kind: "block" as const },
        }
      : null,
    nextBlockId,
    sessionBar: getSessionBar(session.blocks),
    sessionCompleted: session.status === "completed" && nextBlockId === null,
    sessionId,
  };
}
