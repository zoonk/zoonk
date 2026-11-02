import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { arePhaseChallengesRequired } from "../../checkpoints/_utils/phase-challenge-access";
import { type LanguageUnit } from "../units/language-units";
import { findCheckpointUnit, toCheckpointScenarioUnit } from "./_utils/checkpoint-block";
import { getSpeakingLevel } from "./_utils/conversation-goal";
import { findUnitScenario, toScenarioUnit } from "./_utils/conversation-scenario";
import {
  findSpeakingMockSetup,
  findWaitingSpeakingMock,
  writeSpeakingMock,
} from "./_utils/speaking-mock";
import { type CallWriting } from "./call-writing-contract";

export { writeUnitScenario } from "./_utils/conversation-scenario";

type LearnerGoal = { goalId: string; userId: string };

async function findBossUnit(goal: Goal): Promise<LanguageUnit | null> {
  const boss = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    where: { kind: "boss", plan: { goalId: goal.id }, status: "todo" },
  });

  if (!boss || !(await arePhaseChallengesRequired({ goalKind: goal.kind, userId: goal.userId }))) {
    return null;
  }

  return findCheckpointUnit({ goal, planItemId: boss.id });
}

/** The current unit's practice call and the next checkpoint's call, both shared at the level. */
async function listScenarioWritings({ goalId, userId }: LearnerGoal): Promise<CallWriting[]> {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, kind: "language", userId } });
  const targetLanguage = goal?.targetLanguage;

  if (!goal || !targetLanguage) {
    return [];
  }

  const [level, current, boss] = await Promise.all([
    getSpeakingLevel({ goal, targetLanguage, userId }),
    findCheckpointUnit({ goal, planItemId: null }),
    findBossUnit(goal),
  ]);

  const units = [current, boss].filter(
    (unit, index, all): unit is LanguageUnit =>
      unit !== null && all.findIndex((other) => other?.chapterId === unit.chapterId) === index,
  );

  const missing = await Promise.all(
    units.map(async (unit) =>
      (await findUnitScenario({ chapterId: unit.chapterId, level })) ? [] : [unit],
    ),
  );

  return missing
    .flat()
    .map((unit) => ({
      kind: "unitScenario",
      level,
      unit: toScenarioUnit(toCheckpointScenarioUnit({ goal, targetLanguage, unit })),
      userId,
    }));
}

async function findSpeakingMockWriting({ goalId, userId }: LearnerGoal): Promise<CallWriting[]> {
  const setup = await findSpeakingMockSetup({ goalId, userId });

  return setup && !(await findWaitingSpeakingMock(setup))
    ? [{ goalId, kind: "speakingMock", userId }]
    : [];
}

/** Internal, for session preparation: the calls the learner may start soon that aren't written. */
export async function listLanguageCallWritings(learner: LearnerGoal): Promise<CallWriting[]> {
  const writings = await Promise.all([
    listScenarioWritings(learner),
    findSpeakingMockWriting(learner),
  ]);

  return writings.flat();
}

/** Internal, for the call writing workflow: writes nothing while a mock is already waiting. */
export async function prepareSpeakingMock({ goalId, userId }: LearnerGoal): Promise<void> {
  const setup = await findSpeakingMockSetup({ goalId, userId });

  if (setup && !(await findWaitingSpeakingMock(setup))) {
    await writeSpeakingMock(setup);
  }
}

function readExamTaskKey(scenario: unknown): string | null {
  const examTask = isJsonObject(scenario) ? scenario.examTask : null;
  return isJsonObject(examTask) && typeof examTask.task === "string" ? examTask.task : null;
}

/**
 * Internal, for the review workflow once it settled a call: a speaking mock or a task try the
 * learner connected to is followed by the next one, written ahead. Read from the completed call, so
 * a retried settle decides the same.
 */
export async function findNextCallWriting({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}): Promise<CallWriting | null> {
  const call = await prisma.languageConversation.findFirst({
    select: { goalId: true, kind: true, scenario: true, sectionId: true, startedAt: true },
    where: { id: conversationId, status: "completed", userId },
  });

  if (!call?.goalId || !call.startedAt) {
    return null;
  }

  const { goalId } = call;
  const isTaskTry = call.kind === "examSpeaking" && !call.sectionId;
  const task = isTaskTry ? readExamTaskKey(call.scenario) : null;

  if (task) {
    return { goalId, kind: "examTask", task, userId };
  }

  return call.kind === "speakingMock" ? { goalId, kind: "speakingMock", userId } : null;
}
