import "server-only";
import { type LearningEventKind, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { CHECKPOINT_LEDGER_KINDS } from "../../../checkpoints/_utils/checkpoint-results";
import { completePlanItem } from "../../../sessions/_utils/plan-items";
import { applySessionProgress } from "../../../sessions/_utils/session-progress";
import { getAnswersEnergyDelta } from "../../../sessions/brain-power";
import { getCompletionEnergyContext } from "../../../stats/completion-energy";
import { recordLearningEvent } from "../../../stats/record-learning-event";
import { getConversationBrainPower } from "../conversation-rules";
import { type WrittenFeedback } from "./conversation-feedback";
import { type ConversationRow, getCheckpointOutcome } from "./conversation-view";

/** The ledger row of each kind of call; a speaking mock counts as a mock. */
const LEDGER_KINDS = {
  checkpoint: "checkpoint",
  practice: "conversation",
  speakingMock: "mock",
} as const satisfies Record<ConversationRow["kind"], LearningEventKind>;

type ConversationSettlement = {
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

function getLessonKind({ bossKind, row }: Pick<ConversationSettlement, "bossKind" | "row">) {
  if (row.kind === "checkpoint") {
    return CHECKPOINT_LEDGER_KINDS[bossKind];
  }

  return row.kind === "speakingMock" ? "speakingMock" : null;
}

async function findBlockContext(studyBlockId: string | null) {
  if (!studyBlockId) {
    return null;
  }

  return prisma.studySessionBlock.findUnique({
    select: { id: true, payload: true, sessionId: true },
    where: { id: studyBlockId },
  });
}

function readPlanItemId(payload: unknown): string | null {
  const planItemId = isJsonObject(payload) ? payload.planItemId : null;
  return typeof planItemId === "string" ? planItemId : null;
}

/**
 * Writes a finished call once: its feedback (the transcript itself isn't kept), Brain Power and
 * Energy with today's totals, the ledger row and, for a checkpoint call, its session block and
 * plan item. A won checkpoint checks the unit's checkpoint off; a lost one costs nothing. Returns
 * false when the call was already finished, so a second tab never counts it twice.
 */
export async function settleConversation(input: ConversationSettlement): Promise<boolean> {
  const { bossKind, feedback, objectivesMet, row, spokenSeconds, timeZone, userId } = input;

  const checkpoint = getCheckpointOutcome({
    bossKind,
    row: { ...row, objectives: input.objectives, objectivesMet },
  });

  const brainPower = getConversationBrainPower({ checkpoint, objectivesMet: objectivesMet.length });
  const missed = input.objectives - objectivesMet.length;

  const block = await findBlockContext(row.studyBlockId);

  return prisma.$transaction(async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });

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
      where: { id: row.id, status: "ready" },
    });

    if (count === 0) {
      return false;
    }

    await applySessionProgress(tx, {
      completion: true,
      delta: {
        brainPower,
        correctAnswers: objectivesMet.length,
        energyDelta: getAnswersEnergyDelta({ correct: objectivesMet.length, incorrect: missed }),
        incorrectAnswers: missed,
        seconds: spokenSeconds,
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
      seconds: spokenSeconds,
      startedAt: row.startedAt ?? lock.completedAt,
      timeZone,
      titleSnapshot: row.titleSnapshot,
      userId,
    });

    if (block) {
      await tx.studySessionBlock.updateMany({
        data: { brainPower, completedAt: lock.completedAt, status: "completed" },
        where: { id: block.id, status: { in: ["active", "pending"] } },
      });
    }

    if (planItemId && checkpoint?.passed) {
      await completePlanItem(tx, { now: lock.completedAt, planItemId, userId });
    }

    return true;
  });
}
