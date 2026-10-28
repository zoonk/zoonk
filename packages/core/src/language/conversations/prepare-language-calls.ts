import "server-only";
import { prisma } from "@zoonk/db";
import { arePhaseChallengesRequired } from "../../checkpoints/_utils/phase-challenge-access";
import { findCheckpointUnit, toCheckpointScenarioUnit } from "./_utils/checkpoint-block";
import { getSpeakingLevel } from "./_utils/conversation-goal";
import { getUnitScenario } from "./_utils/conversation-scenario";
import {
  findSpeakingMockSetup,
  findWaitingSpeakingMock,
  writeSpeakingMock,
} from "./_utils/speaking-mock";

type LearnerGoal = { goalId: string; userId: string };

/** Internal: `userId` must come from the authenticated session. */
export async function prepareCheckpointCall({ goalId, userId }: LearnerGoal): Promise<void> {
  const [goal, boss] = await Promise.all([
    prisma.goal.findFirst({ where: { id: goalId, kind: "language", userId } }),
    prisma.planItem.findFirst({
      orderBy: { position: "asc" },
      where: { kind: "boss", plan: { goalId }, status: "todo" },
    }),
  ]);

  const targetLanguage = goal?.targetLanguage;

  if (
    !goal ||
    !targetLanguage ||
    !boss ||
    !(await arePhaseChallengesRequired({ goalKind: goal.kind, userId }))
  ) {
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

/** Internal: `userId` must come from the authenticated session. */
export async function prepareSpeakingMock({ goalId, userId }: LearnerGoal): Promise<void> {
  const setup = await findSpeakingMockSetup({ goalId, userId });

  if (setup && !(await findWaitingSpeakingMock(setup))) {
    await writeSpeakingMock(setup);
  }
}
