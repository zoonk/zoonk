import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { parsePlanSettings } from "./planner/plan-state";
import { refreshGoalPlan } from "./refresh-goal-plan";

const START = "2026-01-05";
const TARGET = "2026-03-30";
const DAILY_MINUTES = 30;

type Section = {
  day: number | null;
  kind: string;
  minutes: number;
  name: string;
  questions: number;
};

async function planExam(sections: Section[]) {
  const structure = examStructureSchema.parse({
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "Each correct answer earns one point", method: "raw" },
      sections,
      timeLimitMinutes: sections.reduce((sum, section) => sum + section.minutes, 0),
      totalQuestions: sections.reduce((sum, section) => sum + section.questions, 0),
    },
    rules: [],
    subjects: [],
  });

  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure }),
    planLibraryFixture({ skills: [{ area: "Math", lessons: 40 }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date(START),
    dailyMinutes: DAILY_MINUTES,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { practiceBias: "morePractice", startDate: START },
    targetDate: new Date(TARGET),
    timezone: "UTC",
    userId: user.id,
  });

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  mockSession(user.id);

  return { goal, plan };
}

async function readPlan(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { items: true },
    where: { id: planId },
  });

  return { mocks: plan.items.filter((item) => item.kind === "mock"), plan };
}

describe("exam days whose weekly mock would ask nothing", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${START}T12:00:00Z`));
  });

  afterEach(() => vi.useRealTimers());

  it("leaves a written-only day out of weekly mocks and keeps the learner's settings", async () => {
    const { goal, plan } = await planExam([
      { day: 1, kind: "objective", minutes: 120, name: "Math", questions: 40 },
      { day: 2, kind: "written", minutes: 60, name: "Redação", questions: 1 },
    ]);

    const created = await readPlan(plan.id);
    const settings = parsePlanSettings(created.plan.settings);

    expect(created.mocks.length).toBeGreaterThan(0);
    expect(created.mocks.every((mock) => (mock.minutes ?? 0) > 0)).toBe(true);
    expect(settings.mockFunding.length).toBeGreaterThan(0);
    expect(settings.mockFunding.every((entry) => entry.minutes > 0)).toBe(true);

    expect(settings.mockFunding.filter((entry) => entry.day === 2)).toStrictEqual(
      settings.mockFunding.filter((entry) => entry.day === 2 && entry.fullLength),
    );

    expect(settings.practiceBias).toBe("morePractice");

    await expect(refreshGoalPlan({ goalId: goal.id, mode: "forced" })).resolves.toBeDefined();

    const refreshed = await readPlan(plan.id);

    expect(refreshed.plan.settings).toMatchObject({ practiceBias: "morePractice" });

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: {
          operations: [
            { bias: "moreExplanation", kind: "setPracticeBias" },
            { kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] },
          ],
          timeZone: "UTC",
        },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    const shown = await getGoalPlan(goal.id);

    expect(shown).toMatchObject({
      plan: {
        schedule: { weekdayMinutes: [0, 30, 30, 30, 30, 30, 30] },
        steering: { practiceBias: "moreExplanation" },
      },
    });
  });

  it("gives an exam with nothing to shorten full-length mocks", async () => {
    const { plan } = await planExam([
      { day: 1, kind: "written", minutes: 60, name: "Redação", questions: 1 },
    ]);

    const { mocks, plan: saved } = await readPlan(plan.id);
    const settings = parsePlanSettings(saved.settings);

    expect(mocks.length).toBeGreaterThan(0);
    expect(mocks.every((mock) => mock.minutes === 60)).toBe(true);

    expect(settings.mockFunding.every((entry) => entry.minutes === 60 && entry.fullLength)).toBe(
      true,
    );

    expect(settings.practiceBias).toBe("morePractice");
  });
});
