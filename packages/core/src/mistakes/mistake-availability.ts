import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { getStartOfLocalDay } from "../learner/_utils/local-time";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { readPracticeMistakes } from "../learner/facts/practice-mistakes";
import { type MistakeAvailability } from "./contract";
import {
  type PracticeMistake,
  filterMistakesWithPracticeMaterial,
} from "./mistake-practice-eligibility";

type LocalDay = { localDate: Date; timeZone: string };

/** The run's goal's zone, else the active goal's, else the request's: the notebook, a run and its answers count the same day, and a sent zone can't move it past a stored one. */
export async function getPracticeTimeZone({
  goal,
  timeZone,
  userId,
}: {
  goal: Pick<Goal, "timezone"> | null;
  timeZone?: string | null;
  userId: string;
}): Promise<string> {
  return goal ? getAnswerTimeZone({ goal, timeZone }) : getLearnerTimeZone({ timeZone, userId });
}

/** Practice and fixing require recall on a later local day than the last miss, never repeating a just-shown answer. */
export function readyMistakeWhere({ localDate, timeZone }: LocalDay) {
  return { missedAt: { lt: getStartOfLocalDay({ localDate, timeZone }) }, status: "open" } as const;
}

/** For open mistakes already read; queries filter with `readyMistakeWhere`. */
export function listReadyMistakes<TMistake extends Pick<PracticeMistake, "missedAt">>({
  localDate,
  mistakes,
  timeZone,
}: LocalDay & { mistakes: readonly TMistake[] }): TMistake[] {
  const before = getStartOfLocalDay({ localDate, timeZone }).getTime();
  return mistakes.filter((mistake) => mistake.missedAt.getTime() < before);
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

  const mistakes = await prisma.mistake.findMany({
    select: {
      attemptId: true,
      createdAt: true,
      id: true,
      itemId: true,
      missedAt: true,
      skillId: true,
      snapshot: true,
      stepId: true,
      userId: true,
    },
    where: { skillId, status: "open", userId },
  });

  return filterMistakesWithPracticeMaterial({ mistakes });
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
    where: { ...readyMistakeWhere({ localDate: today, timeZone }), userId },
  });

  if (!candidate) {
    return 0;
  }

  const mistakes = await readPracticeMistakes(userId, goalId);
  return listReadyMistakes({ localDate: today, mistakes, timeZone }).length;
}
