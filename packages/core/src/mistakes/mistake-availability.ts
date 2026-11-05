import "server-only";
import { prisma } from "@zoonk/db";
import { loadLearnerListeningSkillIds } from "../exams/listening/listening-skills";
import { getStartOfLocalDay } from "../learner/_utils/local-time";
import { readPracticeMistakes } from "../learner/facts/practice-mistakes";
import { type MistakeAvailability } from "./contract";
import {
  type PracticeMistake,
  filterMistakesWithPracticeMaterial,
} from "./mistake-practice-eligibility";

/** Fixing requires recall on a later local day, never repeating a just-shown answer. */
export function getMistakePracticeBefore({
  localDate,
  timeZone,
}: {
  localDate: Date;
  timeZone: string;
}): Date {
  return getStartOfLocalDay({ localDate, timeZone });
}

export function listReadyMistakes<TMistake extends Pick<PracticeMistake, "createdAt">>({
  localDate,
  mistakes,
  timeZone,
}: {
  localDate: Date;
  mistakes: readonly TMistake[];
  timeZone: string;
}): TMistake[] {
  const before = getMistakePracticeBefore({ localDate, timeZone }).getTime();
  return mistakes.filter((mistake) => mistake.createdAt.getTime() < before);
}

/** Caller must authorize the learner and scoped goal first; a skill counts only within the goal's, as practice does. */
async function loadPracticeEligibleMistakes({
  goalId,
  skillId,
  userId,
}: {
  goalId?: string;
  skillId?: string;
  userId: string;
}): Promise<PracticeMistake[]> {
  if (goalId) {
    const mistakes = await readPracticeMistakes(userId, goalId);
    return skillId ? mistakes.filter((mistake) => mistake.skillId === skillId) : mistakes;
  }

  const [mistakes, listeningSkillIds] = await Promise.all([
    prisma.mistake.findMany({
      select: { createdAt: true, id: true, itemId: true, skillId: true },
      where: { skillId, status: "open", userId },
    }),
    loadLearnerListeningSkillIds(userId),
  ]);

  return filterMistakesWithPracticeMaterial({
    examBlueprintId: null,
    field: null,
    listeningSkillIds,
    mistakes,
    ownerOf: new Map(),
  });
}

/** Caller must authorize the learner and scoped goal first. */
export async function loadMistakePracticeAvailability({
  localDate,
  timeZone,
  ...scope
}: {
  goalId?: string;
  localDate: Date;
  skillId?: string;
  timeZone: string;
  userId: string;
}): Promise<{
  availability: MistakeAvailability;
  readyIds: ReadonlySet<string>;
  tomorrowIds: ReadonlySet<string>;
}> {
  const eligible = await loadPracticeEligibleMistakes(scope);
  const ready = listReadyMistakes({ localDate, mistakes: eligible, timeZone });
  const readyIds = new Set(ready.map((mistake) => mistake.id));

  const tomorrowIds = new Set(
    eligible.filter((mistake) => !readyIds.has(mistake.id)).map((mistake) => mistake.id),
  );

  return {
    availability: { ready: readyIds.size, tomorrow: tomorrowIds.size },
    readyIds,
    tomorrowIds,
  };
}

export async function countReadyMistakes({
  goalId,
  timeZone,
  today,
  userId,
}: {
  goalId: string;
  timeZone: string;
  today: Date;
  userId: string;
}): Promise<number> {
  const candidate = await prisma.mistake.findFirst({
    select: { id: true },
    where: {
      createdAt: { lt: getMistakePracticeBefore({ localDate: today, timeZone }) },
      status: "open",
      userId,
    },
  });

  if (!candidate) {
    return 0;
  }

  const mistakes = await readPracticeMistakes(userId, goalId);
  return listReadyMistakes({ localDate: today, mistakes, timeZone }).length;
}
