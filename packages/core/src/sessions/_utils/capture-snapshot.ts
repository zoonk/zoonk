import "server-only";
import { type UserProgress, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type findActiveSubscription } from "../../auth/subscription";
import { loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
import { measurePreparation } from "../../preparation/section-preparation";
import { projectPersistedEnergy } from "../../progress/energy";
import { loadGoalLessons } from "../../view-models/syllabus/_utils/load-goal-lessons";
import { getLessonShare } from "../../view-models/syllabus/lesson-share";
import { type SessionSnapshot, type SessionState } from "./session-snapshot";

async function measureGoal({
  goalId,
  now,
  readSubscription,
  userId,
}: {
  goalId: string | null;
  now: Date;
  readSubscription?: typeof findActiveSubscription;
  userId: string;
}): Promise<Pick<SessionState, "preparation" | "progress" | "skillStates">> {
  if (!goalId) {
    return { preparation: null, progress: null, skillStates: {} };
  }

  const [inputs, lessons] = await Promise.all([
    loadPreparationInputs({ goalId, now, subscription: await readSubscription?.(userId), userId }),
    loadGoalLessons(goalId),
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
  readSubscription,
  timeZone,
  userId,
}: {
  goalId: string | null;
  now: Date;
  /** A GET passes `readActiveSubscription`; without it, the subscription is read fresh. */
  readSubscription?: typeof findActiveSubscription;
  timeZone: string;
  userId: string;
}): Promise<SessionState> {
  const [goal, progress] = await Promise.all([
    measureGoal({ goalId, now, readSubscription, userId }),
    measureProgress({ now, timeZone, userId }),
  ]);

  return { ...goal, ...progress };
}

export async function captureSessionSnapshot(
  input: Parameters<typeof measureSessionState>[0],
): Promise<SessionSnapshot> {
  return { ...(await measureSessionState(input)), masteryRewards: {} };
}
