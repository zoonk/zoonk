import "server-only";
import { type Goal, type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { readBlockPayload } from "../../sessions/block-payload";
import { getCheckpointMinutes } from "../checkpoint-minutes";
import { CHECKPOINT_QUESTIONS, MIN_CHECKPOINT_QUESTIONS, getPassMark } from "../checkpoint-rules";
import { loadBossQuestions } from "./load-boss";
import { loadMixedItems } from "./load-weekly-challenge";

function asksCheckpointQuestions({
  goal,
  payload,
}: {
  goal: Pick<Goal, "kind"> | null;
  payload: ReturnType<typeof readBlockPayload>;
}): boolean {
  const { checkpoint } = payload;

  if (!checkpoint || checkpoint.mock) {
    return false;
  }

  return checkpoint.kind === "weekly" || goal?.kind !== "language";
}

/** `afterWriting` permits the minimum playable size after generation ends; otherwise wait for all planned questions. */
export async function fillCheckpointQuestions({
  afterWriting = false,
  block,
  goal,
  now,
  tx = prisma,
  userId,
}: {
  afterWriting?: boolean;
  block: Pick<StudySessionBlock, "id" | "payload" | "status">;
  goal: Pick<Goal, "examBlueprintId" | "kind"> | null;
  now: Date;
  tx?: TransactionClient;
  userId: string;
}): Promise<boolean> {
  const payload = readBlockPayload(block);
  const { checkpoint, skillIds } = payload;
  const examBlueprintId = goal?.examBlueprintId ?? null;

  if (
    !checkpoint ||
    !asksCheckpointQuestions({ goal, payload }) ||
    block.status !== "pending" ||
    payload.itemIds.length >= MIN_CHECKPOINT_QUESTIONS
  ) {
    return true;
  }

  const { itemIds } =
    checkpoint.kind === "weekly"
      ? await loadMixedItems({ examBlueprintId, now, skillIds, userId })
      : await loadBossQuestions({
          examBlueprintId,
          listeningSkillIds: new Set(),
          skillIds,
          userId,
        });

  if (itemIds.length < (afterWriting ? MIN_CHECKPOINT_QUESTIONS : CHECKPOINT_QUESTIONS)) {
    return false;
  }

  await tx.studySessionBlock.update({
    data: {
      estimatedMinutes: getCheckpointMinutes(itemIds.length),
      payload: {
        ...payload,
        checkpoint: { ...checkpoint, passMark: getPassMark(itemIds.length) },
        itemIds,
      },
    },
    where: { id: block.id },
  });

  return true;
}
