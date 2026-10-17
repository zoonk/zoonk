import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { toUTCMidnight } from "@zoonk/utils/date";
import { getWeeklyMockMinutes, listMockClocks } from "../../exams/mocks/mock-plan";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { buildPlan } from "../planner/build-plan";
import { toIsoDate } from "../planner/plan-calendar";
import { parsePlanSettings } from "../planner/plan-state";
import { planLibraryFixture } from "./plan-library";

const DAILY_MINUTES = 180;
const LESSON_MINUTES = 60;

/** Two genuine consecutive weekly mocks in an undated plan with enough written work. */
export async function collidingMockMoveFixture(userId: string) {
  const today = toUTCMidnight(new Date());

  const structure = examStructureSchema.parse({
    formats: [],
    mock: {
      citations: [],
      order: null,
      scoring: { description: "Each correct answer earns one point", method: "raw" },
      sections: [{ day: 1, minutes: 330, name: "Math", questions: 60 }],
      timeLimitMinutes: 330,
      totalQuestions: 60,
    },
    rules: [],
    subjects: [],
  });

  const [blueprint, library] = await Promise.all([
    examBlueprintFixture({ structure }),
    planLibraryFixture({ skills: [{ area: "Math", lessons: 60 }] }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
    }),
  ]);

  await prisma.lesson.updateMany({
    data: { estimatedMinutes: LESSON_MINUTES },
    where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
  });

  const goal = await goalFixture({
    dailyMinutes: DAILY_MINUTES,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: null,
    timezone: "UTC",
    userId,
  });

  const settings = parsePlanSettings({
    pace: { factor: 1, source: "typical" },
    startDate: toIsoDate(today),
    weekdayMinutes: Array.from({ length: 7 }, () => DAILY_MINUTES),
  });

  const built = buildPlan({
    fullMockMinutes: getWeeklyMockMinutes({ fullLength: true, structure }),
    goal,
    graph: library.graph,
    items: [],
    lessons: library.lessons.map((lesson) => ({
      chapterId: lesson.homeChapterId,
      lessonId: lesson.id,
      minutes: LESSON_MINUTES,
      skillIds: library.skills.map((skill) => skill.id),
      title: lesson.title,
    })),
    mockClocks: listMockClocks(structure),
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure }),
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings,
    today,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: library.graph,
    phases: built.phases,
    settings: { ...settings, mockFunding: built.mockFunding },
  });

  await prisma.planItem.createMany({
    data: built.items.map((item, position) => ({
      chapterId: item.chapterId,
      completedAt: item.completedAt,
      kind: item.kind,
      lessonId: item.lessonId,
      lessons: item.lessons,
      phase: item.phase,
      planId: plan.id,
      position,
      scheduledFor: item.scheduledFor,
      skillId: item.skillId,
      status: item.status,
      titleSnapshot: item.titleSnapshot,
    })),
  });

  const mocks = await prisma.planItem.findMany({
    orderBy: { scheduledFor: "asc" },
    take: 2,
    where: { kind: "mock", planId: plan.id, status: "todo" },
  });

  const first = mocks[0];
  const second = mocks[1];

  if (!first?.scheduledFor || !second?.scheduledFor) {
    throw new Error("Expected two retained weekly mocks in the real written plan");
  }

  return { from: toIsoDate(first.scheduledFor), goal, plan, to: toIsoDate(second.scheduledFor) };
}
