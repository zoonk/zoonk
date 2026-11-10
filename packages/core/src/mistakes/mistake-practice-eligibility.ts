import "server-only";
import { prisma } from "@zoonk/db";
import { loadMistakeReplays } from "./mistake-replay";

export type PracticeMistake = { createdAt: Date; id: string; skillId: string | null };

type MaterialMistake = {
  id: string;
  attemptId?: string | null;
  itemId: string | null;
  skillId: string | null;
  stepId: string | null;
  snapshot: unknown;
  userId: string;
};

/** Eligibility and playback use the same exact original, never another question on its skill. */
export async function filterMistakesWithPracticeMaterial<TMistake extends MaterialMistake>({
  mistakes,
}: {
  mistakes: readonly TMistake[];
}): Promise<TMistake[]> {
  const userId = mistakes[0]?.userId;

  if (!userId) {
    return [];
  }

  const material = await loadMistakeReplays({ mistakes, userId });
  return mistakes.filter((mistake) => material.get(mistake.id));
}

export async function loadPracticeMistakes({
  skillIds,
  userId,
}: {
  skillIds: readonly string[];
  userId: string;
}): Promise<PracticeMistake[]> {
  const mistakes = await prisma.mistake.findMany({
    orderBy: { createdAt: "asc" },
    where: { skillId: { in: [...skillIds] }, status: "open", userId },
  });

  return filterMistakesWithPracticeMaterial({ mistakes });
}
