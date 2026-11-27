import "server-only";
import { prisma } from "@zoonk/db";
import { MINUTES_PER_REVIEW } from "../learner/review-load";
import { PRACTICE_MINUTES_PER_QUESTION } from "../sessions/block-minutes";
import { openVisibleMistakeWhere } from "./_utils/visible-mistake";
import { type MistakeReplay, loadMistakeReplays } from "./mistake-replay";

export type PracticeMistake = {
  createdAt: Date;
  id: string;
  missedAt: Date;
  skillId: string | null;
};

export type TimedPracticeMistake = PracticeMistake & { minutes: number };

type MaterialMistake = PracticeMistake & {
  attemptId?: string | null;
  itemId: string | null;
  stepId: string | null;
  snapshot: unknown;
  userId: string;
};

export function getReplayMinutes(replay: MistakeReplay): number {
  const format = replay.kind === "item" ? replay.item.format : replay.lesson.step.kind;

  if (format === "typed" || format === "spokenAnswer" || format === "typedAnswer") {
    return 2;
  }

  return format === "numeric" ? PRACTICE_MINUTES_PER_QUESTION : MINUTES_PER_REVIEW;
}

/** Eligibility and playback use the same exact original, never another question on its skill. */
export async function filterMistakesWithPracticeMaterial({
  mistakes,
}: {
  mistakes: readonly MaterialMistake[];
}): Promise<TimedPracticeMistake[]> {
  const userId = mistakes[0]?.userId;

  if (!userId) {
    return [];
  }

  const material = await loadMistakeReplays({ mistakes, userId });

  return mistakes.flatMap(({ createdAt, id, missedAt, skillId }) => {
    const replay = material.get(id);

    return replay ? [{ createdAt, id, minutes: getReplayMinutes(replay), missedAt, skillId }] : [];
  });
}

export async function loadPracticeMistakes({
  skillIds,
  userId,
}: {
  skillIds: readonly string[];
  userId: string;
}): Promise<TimedPracticeMistake[]> {
  const mistakes = await prisma.mistake.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { ...openVisibleMistakeWhere, skillId: { in: [...skillIds] }, userId },
  });

  return filterMistakesWithPracticeMaterial({ mistakes });
}
