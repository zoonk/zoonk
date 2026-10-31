import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type AnalyticsEvent } from "../../analytics/events";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { conversationScenarioSchema } from "../conversations/conversation-contract";
import { hasPassedConversation } from "../conversations/conversation-rules";
import { type LanguageUnit, isUnitFinished, loadLanguageUnits } from "./language-units";

type UnitGoal = Pick<Goal, "id">;

async function loadWonCallUnitIds({
  chapterIds,
  exceptId,
  userId,
}: {
  chapterIds: readonly string[];
  exceptId?: string;
  userId: string;
}): Promise<Set<string>> {
  const calls = await prisma.languageConversation.findMany({
    select: { chapterId: true, objectivesMet: true, scenario: true },
    where: {
      chapterId: { in: [...chapterIds] },
      id: exceptId ? { not: exceptId } : undefined,
      status: "completed",
      userId,
    },
  });

  return new Set(
    calls.flatMap((call) => {
      const scenario = conversationScenarioSchema.safeParse(call.scenario);
      const objectives = scenario.success ? scenario.data.objectives.length : 0;
      const won = hasPassedConversation({ objectives, objectivesMet: call.objectivesMet.length });

      return won && call.chapterId ? [call.chapterId] : [];
    }),
  );
}

export async function loadDoneUnitIds({
  units,
  userId,
}: {
  units: readonly LanguageUnit[];
  userId: string;
}): Promise<Set<string>> {
  const wonCalls = await loadWonCallUnitIds({
    chapterIds: units.map((unit) => unit.chapterId),
    userId,
  });

  return new Set([
    ...units.filter((unit) => isUnitFinished(unit)).map((unit) => unit.chapterId),
    ...wonCalls,
  ]);
}

function toCanDoEvent(unit: LanguageUnit): AnalyticsEvent {
  return {
    name: "Can-do Reached",
    properties: { can_dos: unit.objectives.length, chapter_id: unit.chapterId },
  };
}

async function findUnitReachedByCall({
  chapterId,
  conversationId,
  goal,
  userId,
}: {
  chapterId: string;
  conversationId: string;
  goal: UnitGoal;
  userId: string;
}): Promise<LanguageUnit | null> {
  const units = await loadLanguageUnits(goal);
  const unit = units.find((item) => item.chapterId === chapterId);

  if (!unit || isUnitFinished(unit)) {
    return null;
  }

  const won = await loadWonCallUnitIds({
    chapterIds: [chapterId],
    exceptId: conversationId,
    userId,
  });

  return won.has(chapterId) ? null : unit;
}

async function findUnitReachedByLesson({
  goal,
  lessonId,
  userId,
}: {
  goal: UnitGoal;
  lessonId: string;
  userId: string;
}): Promise<LanguageUnit | null> {
  const units = await loadLanguageUnits(goal);
  const unit = units.find((item) => item.lessons.some((lesson) => lesson.lessonId === lessonId));

  if (!unit || !isUnitFinished(unit)) {
    return null;
  }

  const won = await loadWonCallUnitIds({ chapterIds: [unit.chapterId], userId });
  return won.has(unit.chapterId) ? null : unit;
}

export async function trackLessonCanDos({
  goals,
  lessonId,
  userId,
}: {
  goals: readonly UnitGoal[];
  lessonId: string;
  userId: string;
}): Promise<void> {
  await Promise.all(
    goals.map(async (goal) => {
      const unit = await findUnitReachedByLesson({ goal, lessonId, userId });

      if (unit) {
        await trackLearnerEvents({ events: [toCanDoEvent(unit)], goalId: goal.id, userId });
      }
    }),
  );
}

export async function trackCallCanDos({
  chapterId,
  conversationId,
  goalId,
  userId,
}: {
  chapterId: string | null;
  conversationId: string;
  goalId: string | null;
  userId: string;
}): Promise<void> {
  if (!chapterId || !goalId) {
    return;
  }

  const goal = await prisma.goal.findFirst({
    select: { id: true, primaryCourseId: true },
    where: { id: goalId, kind: "language", userId },
  });

  const unit = goal
    ? await findUnitReachedByCall({ chapterId, conversationId, goal, userId })
    : null;

  if (goal && unit) {
    await trackLearnerEvents({ events: [toCanDoEvent(unit)], goalId: goal.id, userId });
  }
}
