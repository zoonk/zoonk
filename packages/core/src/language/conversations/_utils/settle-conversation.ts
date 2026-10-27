import "server-only";
import { type LearningEventKind, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { CHECKPOINT_LEDGER_KINDS } from "../../../checkpoints/_utils/checkpoint-results";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { getBlockElapsedMs, pausedBlockTiming } from "../../../sessions/_utils/block-timing";
import { completePlanItem } from "../../../sessions/_utils/plan-items";
import {
  type ProgressChange,
  applySessionProgress,
} from "../../../sessions/_utils/session-progress";
import { readBlockPayload } from "../../../sessions/block-payload";
import { getAnswersEnergyDelta } from "../../../sessions/brain-power";
import { getCompletionEnergyContext } from "../../../stats/completion-energy";
import { recordLearningEvent } from "../../../stats/record-learning-event";
import { getConversationBrainPower } from "../conversation-rules";
import { COMPLETION_REVIEW_LEASE_MS } from "./completion-review-lease";
import { type WrittenFeedback } from "./conversation-feedback";
import { type ConversationRow, getCheckpointOutcome } from "./conversation-view";

/** The ledger row of each kind of call; a speaking mock and an exam's speaking task count as mocks. */
const LEDGER_KINDS = {
  checkpoint: "checkpoint",
  examSpeaking: "mock",
  practice: "conversation",
  speakingMock: "mock",
} as const satisfies Record<ConversationRow["kind"], LearningEventKind>;

const MS_PER_SECOND = 1000;

type ConversationSettlement = {
  completionStartedAt?: Date;
  bossKind: "boss" | "finalBoss";
  feedback: WrittenFeedback | null;
  objectives: number;
  objectivesMet: string[];
  row: ConversationRow;
  spokenSeconds: number;
  timeZone: string;
  usedHelp: boolean;
  userId: string;
};

function completionSettlementWhere({ row, completionStartedAt }: ConversationSettlement) {
  return {
    id: row.id,
    status: "ready" as const,
    ...(completionStartedAt && {
      completionStartedAt,
      updatedAt: { gt: new Date(Date.now() - COMPLETION_REVIEW_LEASE_MS) },
    }),
  };
}

function getLessonKind({ bossKind, row }: Pick<ConversationSettlement, "bossKind" | "row">) {
  if (row.kind === "checkpoint") {
    return CHECKPOINT_LEDGER_KINDS[bossKind];
  }

  return row.kind === "speakingMock" || row.kind === "examSpeaking" ? row.kind : null;
}

async function findBlockContext(tx: TransactionClient, studyBlockId: string | null) {
  if (!studyBlockId) {
    return null;
  }

  /** Queue changes take the block before a linked conversation and can replace its payload. */
  await tx.$queryRaw`
    SELECT id FROM study_session_blocks WHERE id = ${studyBlockId}::uuid FOR UPDATE
  `;

  return tx.studySessionBlock.findUnique({ where: { id: studyBlockId } });
}

function readPlanItemId(payload: unknown): string | null {
  const planItemId = isJsonObject(payload) ? payload.planItemId : null;
  return typeof planItemId === "string" ? planItemId : null;
}

/**
 * Writes a finished call once: its feedback (the transcript itself isn't kept), Brain Power and
 * Energy with today's totals, the ledger row and, for a checkpoint call, its session block and
 * plan item. A won checkpoint checks the unit's checkpoint off; a lost one costs nothing. Returns
 * the Brain Power and Energy before and after it, or null when the call was already finished, so
 * a second tab never counts it twice.
 */
export async function settleConversation(
  input: ConversationSettlement,
): Promise<{ brainPower: ProgressChange; energy: ProgressChange } | null> {
  const { bossKind, feedback, objectivesMet, row, spokenSeconds, timeZone, userId } = input;

  const checkpoint = getCheckpointOutcome({
    bossKind,
    row: { ...row, objectives: input.objectives, objectivesMet },
  });

  const brainPower = getConversationBrainPower({ checkpoint, objectivesMet: objectivesMet.length });
  const missed = input.objectives - objectivesMet.length;

  return writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });
    const block = await findBlockContext(tx, row.studyBlockId);
    const payload = block ? readBlockPayload(block) : null;
    /** Billing and the call keep actual speech; study metrics only count its focused time. */
    const seconds =
      block && payload?.timing
        ? Math.min(
            spokenSeconds,
            Math.floor(getBlockElapsedMs({ block, now: lock.completedAt }) / MS_PER_SECOND),
          )
        : spokenSeconds;

    const { count } = await tx.languageConversation.updateMany({
      data: {
        endedAt: lock.completedAt,
        feedback: feedback?.feedback ?? undefined,
        objectivesMet,
        spokenSeconds,
        status: "completed",
        usedHelp: input.usedHelp,
        ...feedback?.provenance,
      },
      where: completionSettlementWhere(input),
    });

    if (count === 0) {
      return unchanged(null);
    }

    const progress = await applySessionProgress(tx, {
      completion: true,
      delta: {
        brainPower,
        correctAnswers: objectivesMet.length,
        energyDelta: getAnswersEnergyDelta({ correct: objectivesMet.length, incorrect: missed }),
        incorrectAnswers: missed,
        seconds,
      },
      lock,
      userId,
    });

    const planItemId = block ? readPlanItemId(block.payload) : null;

    await recordLearningEvent(tx, {
      brainPower,
      contentIds: {
        conversationId: row.id,
        ...(row.chapterId ? { chapterId: row.chapterId } : {}),
        ...(planItemId ? { planItemId } : {}),
        ...(block ? { studySessionBlockId: block.id, studySessionId: block.sessionId } : {}),
      },
      correctAnswers: objectivesMet.length,
      endedAt: lock.completedAt,
      energyDelta: getAnswersEnergyDelta({ correct: objectivesMet.length, incorrect: missed }),
      goalId: row.goalId,
      incorrectAnswers: missed,
      kind: LEDGER_KINDS[row.kind],
      lessonKind: getLessonKind({ bossKind, row }),
      seconds,
      startedAt: row.startedAt ?? lock.completedAt,
      timeZone,
      titleSnapshot: row.titleSnapshot,
      userId,
    });

    if (block) {
      await tx.studySessionBlock.updateMany({
        data: {
          brainPower,
          completedAt: lock.completedAt,
          ...(payload?.timing && {
            payload: { ...payload, timing: pausedBlockTiming({ block, now: lock.completedAt }) },
          }),
          status: "completed",
        },
        where: { id: block.id, status: { in: ["active", "pending"] } },
      });
    }

    if (planItemId && checkpoint?.passed) {
      await completePlanItem(tx, { now: lock.completedAt, planItemId, userId });
    }

    return progress;
  });
}
