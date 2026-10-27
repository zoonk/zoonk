import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { toUTCMidnight } from "@zoonk/utils/date";
import { listMockClocks } from "../../exams/mocks/mock-plan";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { buildPlan } from "../planner/build-plan";
import { addDays, toIsoDate } from "../planner/plan-calendar";
import { parsePlanSettings } from "../planner/plan-state";
import { planLibraryFixture } from "./plan-library";

const FRIDAY = 5;
const DAYS_PER_WEEK = 7;
const START_DAYS_BEFORE_MOCK = 11;
const EXAM_DAYS_AFTER_MOCK = 5;

const STRUCTURE = examStructureSchema.parse({
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "Each correct answer earns one point", method: "raw" },
    sections: [{ day: 1, kind: "objective", minutes: 330, name: "Math", questions: 60 }],
    timeLimitMinutes: 330,
    totalQuestions: 60,
  },
  rules: [],
  subjects: [],
});

/** A saved weekday plan whose next Friday's half mock cannot fund a full mock on Monday. */
export async function unfundableMockMoveFixture(userId: string) {
  const today = toUTCMidnight(new Date());
  const friday = addDays(today, (FRIDAY - today.getUTCDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK);
  const start = addDays(friday, -START_DAYS_BEFORE_MOCK);
  const monday = addDays(friday, 3);

  const [blueprint, library] = await Promise.all([
    examBlueprintFixture({ structure: STRUCTURE }),
    planLibraryFixture({ skills: [{ area: "Math", lessons: 60 }] }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
    }),
  ]);

  const goal = await goalFixture({
    createdAt: start,
    dailyMinutes: 30,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: addDays(friday, EXAM_DAYS_AFTER_MOCK),
    timezone: "UTC",
    userId,
  });

  const settings = parsePlanSettings({
    pace: { factor: 1, source: "typical" },
    startDate: toIsoDate(start),
    weekdayMinutes: [0, 30, 30, 30, 30, 30, 0],
  });

  const built = buildPlan({
    fullMockMinutes: 330,
    goal,
    graph: library.graph,
    items: [],
    lessons: library.lessons.map((lesson) => ({
      chapterId: lesson.homeChapterId,
      lessonId: lesson.id,
      minutes: lesson.estimatedMinutes,
      skillIds: library.skills.map((skill) => skill.id),
      title: lesson.title,
    })),
    mockClocks: listMockClocks(STRUCTURE),
    mockMinutes: 165,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings,
    today: start,
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

  const mock = await prisma.planItem.findFirstOrThrow({
    where: { kind: "mock", planId: plan.id, scheduledFor: friday },
  });

  return { funding: built.mockFunding, goal, mock, monday, plan };
}
