import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { loadLessonsForSkills } from "../../sessions/_utils/load-plan-lessons";
import { getBlockItemIds, readBlockPayload } from "../../sessions/block-payload";
import { REINFORCEMENT_LESSONS, getMissedSkills } from "../checkpoint-rules";
import { type CheckpointResult } from "./checkpoint-results";

/** The same available lessons drive tomorrow's rematch and the count promised on a loss. */
export async function loadCheckpointReinforcement({
  block,
  userId,
}: {
  block: StudySessionBlock | null;
  userId: string;
}) {
  const payload = block ? readBlockPayload(block) : null;

  if (
    !block ||
    block.kind !== "checkpoint" ||
    !payload?.checkpoint?.passMark ||
    payload.checkpoint.kind === "weekly"
  ) {
    return [];
  }

  const answers = await prisma.attempt.findMany({
    orderBy: [{ answeredAt: "asc" }, { id: "asc" }],
    select: { isCorrect: true, itemId: true, skillId: true },
    where: { itemId: { in: getBlockItemIds(payload) }, studySessionId: block.sessionId, userId },
  });

  // One latest verdict per question, including duplicate attempts already stored.
  const latest = new Map(answers.map((answer) => [answer.itemId, answer]));
  const skillIds = getMissedSkills([...latest.values()]);

  return skillIds.length > 0
    ? loadLessonsForSkills({ limit: REINFORCEMENT_LESSONS, skillIds })
    : [];
}

/** A finished loss's lessons, also used when the next day's session schedules its rematch. */
export async function loadResultReinforcement({
  result,
  userId,
}: {
  result: CheckpointResult | null;
  userId: string;
}) {
  if (!result || result.passed || !result.studySessionBlockId || !result.studySessionId) {
    return [];
  }

  const block = await prisma.studySessionBlock.findFirst({
    where: {
      id: result.studySessionBlockId,
      session: { userId },
      sessionId: result.studySessionId,
    },
  });

  return loadCheckpointReinforcement({ block, userId });
}
