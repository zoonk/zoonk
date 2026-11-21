import "server-only";
import { type UserProgress, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
import { measurePreparation } from "../../preparation/section-preparation";
import { projectPersistedEnergy } from "../../progress/energy";
import { loadGoalLessons } from "../../view-models/syllabus/_utils/load-goal-lessons";
import { getLessonShare } from "../../view-models/syllabus/lesson-share";
import { type SyllabusView } from "../../view-models/syllabus/syllabus-contract";
import { type SessionSnapshot, type SessionState } from "./session-snapshot";

/** A GET's request-cached reads of the goal; writes leave them out to read fresh. */
export type GoalStateReads = {
  lessons: () => Promise<SyllabusView["lessons"] | null>;
  preparation: () => ReturnType<typeof loadPreparationInputs>;
};

async function measureGoal({
  goalId,
  now,
  reads,
  userId,
}: {
  goalId: string | null;
  now: Date;
  reads?: GoalStateReads;
  userId: string;
}): Promise<Pick<SessionState, "preparation" | "progress" | "skillStates">> {
  if (!goalId) {
    return { preparation: null, progress: null, skillStates: {} };
  }

  const [inputs, lessons] = await Promise.all([
    reads ? reads.preparation() : loadPreparationInputs({ goalId, now, userId }),
    reads ? reads.lessons() : loadGoalLessons(goalId),
  ]);

  return {
    preparation:
      inputs.skills.length > 0 ? measurePreparation({ ...inputs, asOf: now }).value : null,
    progress: lessons && lessons.total > 0 ? getLessonShare(lessons) : null,
    skillStates: Object.fromEntries(inputs.skills.map((skill) => [skill.skillId, skill.state])),
  };
}

export async function measureProgress({
  now,
  progress: providedProgress,
  timeZone,
  userId,
}: {
  now: Date;
  progress?: UserProgress | null | Promise<UserProgress | null>;
  timeZone: string;
  userId: string;
}): Promise<{ brainPower: number; energy: number }> {
  const progress =
    providedProgress === undefined
      ? await prisma.userProgress.findUnique({ where: { userId } })
      : await providedProgress;

  if (!progress) {
    return { brainPower: 0, energy: 0 };
  }

  const { currentEnergy } = projectPersistedEnergy({
    persistedEnergy: progress,
    targetDate: getDateInTimeZone({ date: now, timeZone }),
    timeZone,
  });

  return { brainPower: Number(progress.totalBrainPower), energy: currentEnergy };
}

export async function measureSessionState({
  goalId,
  now,
  reads,
  timeZone,
  userId,
}: {
  goalId: string | null;
  now: Date;
  reads?: GoalStateReads;
  timeZone: string;
  userId: string;
}): Promise<SessionState> {
  const [goal, progress] = await Promise.all([
    measureGoal({ goalId, now, reads, userId }),
    measureProgress({ now, timeZone, userId }),
  ]);

  return { ...goal, ...progress };
}

export async function captureSessionSnapshot(
  input: Parameters<typeof measureSessionState>[0],
): Promise<SessionSnapshot> {
  return { ...(await measureSessionState(input)), masteryRewards: {} };
}
