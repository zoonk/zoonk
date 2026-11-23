import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { openTodayView } from "../sessions/_test-utils/open-today-view";
import { getTodayView } from "../view-models/today/get-today-view";
import { AHEAD_START, readPlanScreen } from "./_test-utils/ahead-plan";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createSetUpGoalPlan } from "./_test-utils/set-up-plan";
import { applyNoticeGraph } from "./apply-notice-graph";
import { changeGoalPlan } from "./change-goal-plan";
import { parsePlanGraph, parsePlanSettings } from "./planner/plan-state";

async function createExam({
  dailyMinutes,
  strategyLessons = 5,
  targetDate = "2020-10-05",
}: {
  dailyMinutes: number;
  strategyLessons?: number;
  targetDate?: string;
}) {
  const [blueprint, user, library] = await Promise.all([
    examBlueprintFixture({
      edition: {
        check: null,
        citations: [],
        dates: [],
        noticeUrl: "https://example.org/official-guide",
        questionCount: null,
        sourceHash: null,
        timeZone: null,
        year: 2020,
      },
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: [
          {
            citation: { passage: "", sourceId: "notice" },
            name: "Math",
            questions: 1,
            topics: ["Fractions"],
            weight: 1,
          },
        ],
      },
    }),
    userFixture(),
    planLibraryFixture({
      skills: [
        { area: "Math", lessons: 1 },
        { area: "Exam strategy", lessons: strategyLessons },
        { area: "Logic", lessons: 1 },
      ],
    }),
  ]);

  const [math, strategy, logic] = library.graph.skills;

  if (!math || !strategy || !logic) {
    throw new Error("Expected math, strategy and logic");
  }

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-29" },
    targetDate: new Date(targetDate),
    timezone: "UTC",
    userId: user.id,
  });

  await createSetUpGoalPlan({
    goalId: goal.id,
    graph: { ...library.graph, skills: [math, logic] },
  });

  mockSession(user.id);

  const reading = {
    blueprintId: blueprint.id,
    goalId: goal.id,
    graph: {
      extraSkills: [strategy],
      phases: library.graph.phases,
      skills: [
        { ...math, topics: ["Fractions"] },
        { ...logic, topics: [] },
      ],
    },
  };

  await expect(applyNoticeGraph(reading)).resolves.toBe(true);
  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

  expect(parsePlanGraph(saved.graph).skills.map((skill) => skill.skillId)).toStrictEqual([
    math.skillId,
  ]);

  const operations = [{ kind: "setExtras" as const, skillIds: [strategy.skillId] }];

  return { operations, plan, reading, strategy };
}

describe("exam strategy after a notice lands", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHEAD_START);
  });

  afterEach(() => vi.useRealTimers());

  it("offers the whole extra when it fits and preserves the accepted lessons at the next landing", async () => {
    const { operations, plan, reading, strategy } = await createExam({ dailyMinutes: 40 });

    await expect(readPlanScreen()).resolves.toMatchObject({
      extraOffer: { canApply: true, lessons: 5, operations },
    });

    await expect(
      changeGoalPlan({ goalId: reading.goalId, input: { operations } }),
    ).resolves.toMatchObject({ status: "applied" });

    await expect(
      applyNoticeGraph({
        ...reading,
        droppedSkillIds: [strategy.skillId],
        graph: {
          ...reading.graph,
          extraSkills: [],
          skills: reading.graph.skills.map((skill) => ({
            ...skill,
            name: `${skill.name} updated`,
          })),
        },
      }),
    ).resolves.toBe(true);

    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanGraph(after.graph).extraSkills).toStrictEqual([strategy]);
    expect(parsePlanSettings(after.settings).extras).toStrictEqual([strategy.skillId]);

    await expect(
      prisma.planItem.count({
        where: { kind: "lesson", planId: plan.id, skillId: strategy.skillId, status: "todo" },
      }),
    ).resolves.toBe(5);

    const notices = await prisma.planChange.findMany({
      select: { payload: true },
      where: { kind: "noticeChanged", planId: plan.id },
    });

    expect(notices).toMatchObject([{ payload: { effect: { noticeRemoved: ["Logic"] } } }]);
  });

  it("stores the notice's extra without offering it when time is short", async () => {
    const { plan, strategy } = await createExam({ dailyMinutes: 5 });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanGraph(saved.graph).extraSkills).toStrictEqual([strategy]);
    await expect(readPlanScreen()).resolves.toMatchObject({ extraOffer: null });
  });

  it("shows the same strategy lesson before and after opening a shortened review day", async () => {
    const { operations, plan, reading, strategy } = await createExam({
      dailyMinutes: 40,
      strategyLessons: 20,
      targetDate: "2020-11-07",
    });

    await expect(
      changeGoalPlan({ goalId: reading.goalId, input: { operations } }),
    ).resolves.toMatchObject({ status: "applied" });

    const reviews = await prisma.planItem.findMany({
      select: { scheduledFor: true },
      where: { kind: "review", planId: plan.id, status: "todo" },
    });

    const lesson = await prisma.planItem.findFirstOrThrow({
      orderBy: { scheduledFor: "asc" },
      where: {
        lessonId: { not: null },
        planId: plan.id,
        scheduledFor: { in: reviews.flatMap((review) => review.scheduledFor ?? []) },
        skillId: strategy.skillId,
        status: "todo",
      },
    });

    if (!lesson.scheduledFor) {
      throw new Error("Expected the planner to schedule strategy alongside a review");
    }

    vi.setSystemTime(new Date(lesson.scheduledFor).setUTCHours(12));

    const request = { goalId: reading.goalId, timeZone: "UTC" };
    const preview = await getTodayView(request);

    if (preview.status !== "ready") {
      throw new Error(`Expected Today's preview, got ${preview.status}`);
    }

    const scheduled = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      select: { lessonId: true },
      where: {
        lessonId: { not: null },
        planId: plan.id,
        scheduledFor: lesson.scheduledFor,
        skillId: strategy.skillId,
        status: "todo",
      },
    });

    const expected = scheduled.map(({ lessonId }) => ({
      lessonId,
      subject: null,
      subjectExtra: "notice",
    }));

    expect(preview.today.session.blocks.filter((block) => block.kind === "learn")).toMatchObject(
      expected,
    );

    const opened = await openTodayView(request);

    expect(opened.today.session.blocks.filter((block) => block.kind === "learn")).toMatchObject(
      expected,
    );
  });
});
