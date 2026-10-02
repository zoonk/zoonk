import "server-only";
import { type MasteryState, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
import { getPreparationComponents, getPreparationValue } from "../../preparation/preparation-math";
import { projectPersistedEnergy } from "../../progress/energy";
import { type SessionSnapshot } from "./session-snapshot";

/** A goal's preparation and each of its skills' state at one moment. */
export async function measureGoal({
  goalId,
  now,
  userId,
}: {
  goalId: string | null;
  now: Date;
  userId: string;
}): Promise<{ preparation: number | null; skillStates: Record<string, MasteryState> }> {
  if (!goalId) {
    return { preparation: null, skillStates: {} };
  }

  const inputs = await loadPreparationInputs({ goalId, now, userId });

  return {
    preparation:
      inputs.skills.length > 0
        ? getPreparationValue(getPreparationComponents({ ...inputs, asOf: now }))
        : null,
    skillStates: Object.fromEntries(inputs.skills.map((skill) => [skill.skillId, skill.state])),
  };
}

/** The learner's Energy (decayed through inactive days) and Brain Power total right now. */
export async function measureProgress({
  now,
  timeZone,
  userId,
}: {
  now: Date;
  timeZone: string;
  userId: string;
}): Promise<{ brainPower: number; energy: number }> {
  const progress = await prisma.userProgress.findUnique({ where: { userId } });

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

/** Where the learner stands as the session's first block starts. */
export async function captureSessionSnapshot({
  goalId,
  now,
  timeZone,
  userId,
}: {
  goalId: string | null;
  now: Date;
  timeZone: string;
  userId: string;
}): Promise<SessionSnapshot> {
  const [goal, progress] = await Promise.all([
    measureGoal({ goalId, now, userId }),
    measureProgress({ now, timeZone, userId }),
  ]);

  return { ...goal, ...progress, masteryRewards: {} };
}
