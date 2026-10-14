import "server-only";
import { type Goal, type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { readBlockPayload } from "../../sessions/block-payload";
import { getCheckpointMinutes } from "../checkpoint-minutes";
import { CHECKPOINT_QUESTIONS, MIN_CHECKPOINT_QUESTIONS, getPassMark } from "../checkpoint-rules";
import { loadBossQuestions } from "./load-boss";
import { loadMixedItems } from "./load-weekly-challenge";

/**
 * Whether a block asks a checkpoint's questions: a mock picks and writes its own
 * (`requestMockQuestions`), and a language goal's phase checkpoint is the unit's call.
 */
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

/**
 * A checkpoint planned while the bank held too few questions for it (`getPlannedQuestions`) picks
 * them again as it starts, from what was written since: true once it has enough to ask, its block
 * then holding them with the pass mark and time their count gives; false while too few exist, so
 * they're written first (`requestChallengeQuestions`). Enough is the ten it was planned with, so
 * a Start between two of a run's calls waits for the run instead of opening on the one skill
 * written so far; `afterWriting`, once the learner waited for the run to end, the five that judge
 * a phase, so a skill whose questions keep failing never holds the challenge back. Any other
 * block starts as it is.
 */
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

  // A boss held short asks text questions: a phase heard only through recordings isn't held.
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
