import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { SPEAKING_MOCK_LANGUAGE, getSpeakingMockExam } from "../../../exams/language-exam";
import { type SpeakingMockExam } from "../conversation-contract";
import { SPEAKING_MOCK_MINUTES } from "../speaking-mock-format";
import { getSpeakingLevel } from "./conversation-goal";
import { getSpeakingMockScenario } from "./conversation-scenario";
import { createConversation } from "./create-conversation";

export type SpeakingMockSetup = { exam: SpeakingMockExam; goal: Goal; level: CefrLevel };

export async function findSpeakingMockSetup({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<SpeakingMockSetup | null> {
  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      kind: { in: ["exam", "language"] },
      targetLanguage: SPEAKING_MOCK_LANGUAGE,
      userId,
    },
  });

  const exam = goal ? getSpeakingMockExam(goal) : null;

  if (!goal || !exam) {
    return null;
  }

  const level = await getSpeakingLevel({ goal, targetLanguage: SPEAKING_MOCK_LANGUAGE, userId });
  return { exam, goal, level };
}

function isMockFor({ exam, scenario }: { exam: SpeakingMockExam; scenario: unknown }): boolean {
  return isJsonObject(scenario) && scenario.exam === exam;
}

export async function findWaitingSpeakingMock({
  exam,
  goal,
  level,
}: SpeakingMockSetup): Promise<{ id: string } | null> {
  const waiting = await prisma.languageConversation.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, scenario: true },
    where: {
      goalId: goal.id,
      kind: "speakingMock",
      level,
      startedAt: null,
      status: "ready",
      userId: goal.userId,
    },
  });

  return waiting.find((row) => isMockFor({ exam, scenario: row.scenario })) ?? null;
}

export async function writeSpeakingMock({ exam, goal, level }: SpeakingMockSetup) {
  const scenario = await getSpeakingMockScenario({
    exam,
    goalId: goal.id,
    language: goal.language,
    level,
    targetLanguage: SPEAKING_MOCK_LANGUAGE,
    userId: goal.userId,
  });

  return createConversation({
    chapterId: null,
    goal,
    kind: "speakingMock",
    language: goal.language,
    level,
    markChanged: true,
    minutes: SPEAKING_MOCK_MINUTES,
    scenario: { ...scenario, exam },
    targetLanguage: SPEAKING_MOCK_LANGUAGE,
    userId: goal.userId,
  });
}
