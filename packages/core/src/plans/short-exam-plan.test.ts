import { type PlanItem, prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getExamView } from "../exams/view/get-exam-view";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getTodayStudySession } from "../sessions/get-today-study-session";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { parsePlanSettings } from "./planner/plan-state";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A Wednesday: Bia uploads her slides and plans for her biochemistry test. */
const TODAY = new Date("2026-09-30T00:00:00Z");
const DAY_MS = 86_400_000;

function day(offset: number): Date {
  return new Date(TODAY.getTime() + offset * DAY_MS);
}

function isoDay(offset: number): string {
  return day(offset).toISOString().slice(0, 10);
}

function setClock(offset: number) {
  const now = new Date(day(offset).getTime() + 12 * 60 * 60 * 1000);

  vi.setSystemTime(now);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: day(offset),
    currentInstant: now,
    timeZone: "UTC",
  });
}

/** A teacher's test read from slides says nothing about its length. */
const CLASS_TEST_STRUCTURE = { formats: [], mock: null, rules: [], subjects: [] };

/** A public exam's notice gives its day in real conditions: 90 questions in three hours. */
const PUBLIC_EXAM_STRUCTURE = {
  ...CLASS_TEST_STRUCTURE,
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [],
    timeLimitMinutes: 180,
    totalQuestions: 90,
  },
};

/**
 * Bia's exam map from last year's test: enzymes came up four times, glycolysis three, the Krebs
 * cycle and the respiratory chain twice. Placement found glycolysis solid. A class test read from
 * her own material has a private blueprint, whose mock is ten questions in half an hour.
 */
async function setup({
  dailyMinutes = 45,
  days,
  isPrivate = true,
}: {
  dailyMinutes?: number;
  days: number;
  isPrivate?: boolean;
}) {
  const user = await userFixture();

  const [blueprint, library] = await Promise.all([
    examBlueprintFixture(
      isPrivate
        ? {
            name: "Biochemistry test",
            ownerId: user.id,
            structure: CLASS_TEST_STRUCTURE,
            visibility: "private",
          }
        : { name: "Public biochemistry exam", structure: PUBLIC_EXAM_STRUCTURE },
    ),
    planLibraryFixture({
      skills: [
        { area: "Biochemistry", lessons: 3, weight: 4 },
        { area: "Biochemistry", lessons: 3, weight: 3 },
        { area: "Biochemistry", lessons: 3, weight: 2 },
        { area: "Biochemistry", lessons: 3, weight: 2 },
      ],
    }),
  ]);

  const [enzymes, glycolysis] = library.skills;

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: day(days),
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all([
    ...library.skills.flatMap((skill) =>
      [0, 1, 2].map(() => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
    ),
    learnerSkillFixture({
      difficulty: 3,
      due: day(20),
      lastReviewedAt: day(-2),
      reps: 3,
      skillId: glycolysis?.id ?? "",
      stability: 30,
      state: "solid",
      userId: user.id,
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  return { enzymes, glycolysis, goal, plan, user };
}

async function loadItems(planId: string): Promise<PlanItem[]> {
  return prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId } });
}

function datesOf({ items, kind }: { items: readonly PlanItem[]; kind: PlanItem["kind"] }) {
  return items
    .filter((item) => item.kind === kind)
    .map((item) => item.scheduledFor?.toISOString().slice(0, 10) ?? null);
}

async function readPlanView(goalId: string) {
  const result = await getGoalPlan(goalId);

  if (result.status !== "ready") {
    throw new Error(`Expected a plan, got ${result.status}`);
  }

  return result.plan;
}

describe("a class test days away", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("in three days: the gaps first, practice, then the short mock the day before", async () => {
    const { enzymes, glycolysis, goal, plan } = await setup({ days: 3 });
    const items = await loadItems(plan.id);
    const lessons = items.filter((item) => item.kind === "lesson");

    expect(lessons[0]?.skillId).toBe(enzymes?.id);
    expect(lessons.at(-1)?.skillId).toBe(glycolysis?.id);
    expect(datesOf({ items, kind: "boss" })).toStrictEqual([]);
    expect(datesOf({ items, kind: "mock" })).toStrictEqual([isoDay(2)]);
    expect(datesOf({ items, kind: "review" })).toStrictEqual([isoDay(2)]);
    expect(datesOf({ items, kind: "lesson" })).not.toContain(isoDay(2));

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(stored.settings).shortMockMinutes).toBe(30);

    const view = await readPlanView(goal.id);

    expect(view.shortPlan).toStrictEqual({ days: 3, mockDate: isoDay(2) });

    expect(view.phases.map((phase) => [phase.kind, phase.short])).toStrictEqual([
      ["gaps", { firstDay: 1, focus: "mapAndGaps", lastDay: 1 }],
      ["practice", { firstDay: 2, focus: "practice", lastDay: 2 }],
      ["finalStretch", { firstDay: 3, focus: "mockAndReview", lastDay: 3 }],
    ]);

    expect(view.week.days.find((entry) => entry.date === isoDay(2))?.minutes).toBe(45);
  });

  it("in seven days: four days of map and gaps, two of practice, the mock on the seventh", async () => {
    const { goal, plan } = await setup({ days: 7 });
    const items = await loadItems(plan.id);
    const view = await readPlanView(goal.id);

    expect(view.phases.map((phase) => phase.short)).toStrictEqual([
      { firstDay: 1, focus: "mapAndGaps", lastDay: 4 },
      { firstDay: 5, focus: "practice", lastDay: 6 },
      { firstDay: 7, focus: "mockAndReview", lastDay: 7 },
    ]);

    expect(datesOf({ items, kind: "mock" })).toStrictEqual([isoDay(6)]);
    expect(datesOf({ items, kind: "boss" })).toStrictEqual([]);
    expect(datesOf({ items, kind: "lesson" })).not.toContain(isoDay(6));
  });

  it("tomorrow: today teaches the gaps and the short mock closes it", async () => {
    const { enzymes, goal, plan } = await setup({ dailyMinutes: 60, days: 1 });
    const items = await loadItems(plan.id);

    expect(items.find((item) => item.kind === "lesson")?.skillId).toBe(enzymes?.id);
    expect(datesOf({ items, kind: "lesson" })).toContain(isoDay(0));
    expect(datesOf({ items, kind: "mock" })).toStrictEqual([isoDay(0)]);
    expect(items.at(-1)?.kind).toBe("mock");

    const view = await readPlanView(goal.id);

    expect(view.shortPlan).toStrictEqual({ days: 1, mockDate: isoDay(0) });
    expect(view.week.days.find((entry) => entry.date === isoDay(0))?.minutes).toBe(60);
  });

  it("builds day 1 around new lessons and the last day around the mock, nothing new", async () => {
    const { goal } = await setup({ days: 3 });
    const first = await getTodayView({ goalId: goal.id });

    if (first.status !== "ready") {
      throw new Error(`Expected Today, got ${first.status}`);
    }

    expect(first.today.shortPlan).toStrictEqual({
      day: 1,
      days: 3,
      focus: "mapAndGaps",
      mockDate: day(2),
    });

    const firstKinds = first.today.session.blocks.map((block) => block.kind);

    expect(firstKinds).toContain("learn");
    expect(firstKinds).not.toContain("checkpoint");
    expect(first.today.weeklyChallenge).toMatchObject({ date: day(2), kind: "mock" });

    // She did every lesson on the first two days.
    await prisma.planItem.updateMany({
      data: { completedAt: day(1), status: "done" },
      where: { kind: "lesson", plan: { goalId: goal.id } },
    });

    setClock(2);
    const last = await getTodayStudySession({ goalId: goal.id });

    if (last.status !== "ready") {
      throw new Error(`Expected the last day's session, got ${last.status}`);
    }

    const lastKinds = last.session.blocks.map((block) => block.kind);

    expect(lastKinds).not.toContain("learn");

    expect(last.session.blocks.at(-1)).toMatchObject({
      checkpoint: { kind: "weekly", mock: true, timeLimitMinutes: 30 },
      kind: "checkpoint",
    });

    // Today and the exam screen both say the day before is the short mock, not a light review.
    const [todayView, examView] = await Promise.all([
      getTodayView({ goalId: goal.id }),
      getExamView({ goalId: goal.id }),
    ]);

    // A class test has no ID check or gates: what the teacher allows, and sleep.
    expect(todayView.status === "ready" && todayView.today.exam).toMatchObject({
      checklist: ["materials", "sleep"],
      dayBefore: "mock",
      stage: "dayBefore",
    });

    expect(examView.status === "ready" && examView.exam).toMatchObject({
      dayBefore: "mock",
      stage: "dayBefore",
    });
  });

  it("still runs the short mock for a learner who first opens the app the day before", async () => {
    const { goal } = await setup({ days: 3 });

    // She skipped the first two days, so the re-plan has no room left for any lesson.
    setClock(2);
    const last = await getTodayStudySession({ goalId: goal.id });

    if (last.status !== "ready") {
      throw new Error(`Expected the last day's session, got ${last.status}`);
    }

    expect(last.session.blocks.at(-1)).toMatchObject({
      checkpoint: { kind: "weekly", mock: true },
      kind: "checkpoint",
    });

    expect(last.session.blocks.at(-1)?.questions).toBeGreaterThan(0);
  });
});

describe("other exams", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives a public exam days away the same days, with a light review instead of a mock", async () => {
    const { goal, plan } = await setup({ days: 3, isPrivate: false });
    const items = await loadItems(plan.id);
    const view = await readPlanView(goal.id);

    expect(datesOf({ items, kind: "mock" })).toStrictEqual([]);
    expect(datesOf({ items, kind: "review" })).toStrictEqual([isoDay(2)]);
    expect(view.shortPlan).toStrictEqual({ days: 3, mockDate: null });

    expect(view.phases.at(-1)?.short).toStrictEqual({
      firstDay: 3,
      focus: "lightReview",
      lastDay: 3,
    });

    expect(view.week.days.find((entry) => entry.date === isoDay(2))?.minutes).toBe(15);
  });

  it("keeps a long-date exam's four phases, weekly mocks and phase checkpoints", async () => {
    const { goal, plan } = await setup({ days: 40, isPrivate: false });
    const items = await loadItems(plan.id);
    const view = await readPlanView(goal.id);

    expect(view.shortPlan).toBeNull();

    expect(view.phases.map((phase) => [phase.kind, phase.short])).toStrictEqual([
      ["foundations", null],
      ["gaps", null],
      ["practice", null],
      ["finalStretch", null],
    ]);

    expect(datesOf({ items, kind: "mock" }).length).toBeGreaterThan(0);
    expect(datesOf({ items, kind: "boss" }).length).toBeGreaterThan(0);
    expect(datesOf({ items, kind: "review" }).at(-1)).toBe(isoDay(39));
  });
});
