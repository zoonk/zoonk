import { prisma } from "@zoonk/db";
import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getWeeklyMockMinutes, listMockClocks } from "../../exams/mocks/mock-plan";
import { buildPlan } from "../planner/build-plan";
import { type PlanGraph, parsePlanSettings } from "../planner/plan-state";

const PRIOR_DAY = new Date("2026-10-13T12:00:00Z");

/** The actual previous-day Main fixture, including the planner's joined unwritten work. */
async function createPriorDayPlan() {
  const user = await userFixture();

  const [goal, skills] = await Promise.all([
    goalFixture({
      createdAt: PRIOR_DAY,
      dailyMinutes: 12,
      kind: "learn",
      targetDate: null,
      timezone: "UTC",
      userId: user.id,
    }),
    Promise.all([
      skillFixture({ name: "Opening the interview" }),
      skillFixture({ name: "Follow-up questions" }),
    ]),
  ]);

  const graph: PlanGraph = {
    phases: [
      { milestone: null, name: "First interviews" },
      { milestone: null, name: "Practice" },
    ],
    skills: skills.map((skill, index) => ({
      area: "Interviews",
      lessons: index === 0 ? 12 : 60,
      name: skill.name,
      phase: index,
      skillId: skill.id,
      weight: null,
    })),
  };

  // A saved plan keeps the pace it was built with; unrelated learners must not resample it.
  const pace = { factor: 1, source: "typical" as const };
  const settings = parsePlanSettings({ pace, startDate: "2026-10-13" });

  const built = buildPlan({
    fullMockMinutes: getWeeklyMockMinutes({ fullLength: true, structure: null }),
    goal,
    graph,
    items: [],
    lessons: [],
    mockClocks: listMockClocks(null),
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure: null }),
    mode: "forced",
    paceFactor: pace.factor,
    prerequisites: new Map(),
    readiness: new Map(),
    settings,
    today: new Date("2026-10-13T00:00:00Z"),
  });

  const plan = await planFixture({
    createdAt: PRIOR_DAY,
    goalId: goal.id,
    graph,
    phases: built.phases,
    settings: { ...settings, mockFunding: built.mockFunding },
  });

  await Promise.all([
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    prisma.planItem.createMany({
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
    }),
  ]);

  return { built, goal, plan, user };
}

/** A real saved plan whose missed day causes an exact, mandatory Oct 21 → 24 phase move. */
export async function mandatoryPhasePlanFixture() {
  const fixture = await createPriorDayPlan();

  await prisma.plan.update({
    data: {
      settings: {
        ...parsePlanSettings(fixture.plan.settings),
        weekdayMinutes: Array.from({ length: 7 }, (_, day) => (day === 3 ? 0 : 12)),
      },
    },
    where: { id: fixture.plan.id },
  });

  const pending = await planChangeFixture({
    kind: "edited",
    payload: { operations: [{ kind: "fitPhaseDates" }], source: "phaseDates" },
    planId: fixture.plan.id,
    status: "proposed",
  });

  return { ...fixture, pending };
}
