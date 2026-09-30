import "server-only";
import { prisma } from "@zoonk/db";
import { findCheckpointUnit, toCheckpointScenarioUnit } from "./_utils/checkpoint-block";
import { getSpeakingLevel } from "./_utils/conversation-goal";
import { getUnitScenario } from "./_utils/conversation-scenario";
import {
  findSpeakingMockSetup,
  findWaitingSpeakingMock,
  writeSpeakingMock,
} from "./_utils/speaking-mock";

type LearnerGoal = { goalId: string; userId: string };

/**
 * Writes the call of a language goal's next checkpoint ahead: the unit its next boss closes, at the
 * level the learner speaks at now. It's shared with every learner of the unit, and a unit's call
 * already written isn't written again, so the checkpoint opens without waiting on a model. Nothing
 * for other goals.
 */
export async function prepareCheckpointCall({ goalId, userId }: LearnerGoal): Promise<void> {
  const [goal, boss] = await Promise.all([
    prisma.goal.findFirst({ where: { id: goalId, kind: "language", userId } }),
    prisma.planItem.findFirst({
      orderBy: { position: "asc" },
      where: { kind: "boss", plan: { goalId }, status: "todo" },
    }),
  ]);

  const targetLanguage = goal?.targetLanguage;

  if (!goal || !targetLanguage || !boss) {
    return;
  }

  const [unit, level] = await Promise.all([
    findCheckpointUnit({ goal, planItemId: boss.id }),
    getSpeakingLevel({ goal, targetLanguage, userId }),
  ]);

  if (unit) {
    await getUnitScenario({
      level,
      unit: toCheckpointScenarioUnit({ goal, targetLanguage, unit }),
      userId,
    });
  }
}

/**
 * Writes the goal's next speaking mock ahead, once: when the goal has an IELTS or TOEFL mock and
 * none is waiting at the learner's level, its examiner and script are written now and kept as a
 * call not opened yet, so the next mock starts without waiting on a model. Nothing for other goals.
 */
export async function prepareSpeakingMock({ goalId, userId }: LearnerGoal): Promise<void> {
  const setup = await findSpeakingMockSetup({ goalId, userId });

  if (setup && !(await findWaitingSpeakingMock(setup))) {
    await writeSpeakingMock(setup);
  }
}
