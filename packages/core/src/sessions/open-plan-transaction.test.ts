import { type TransactionClient, prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonsFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { parsePlanChangePayload } from "../plans/_utils/plan-change-payload";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPlan } from "../plans/get-goal-plan";
import * as producer from "../plans/planner/build-plan";
import { getTodayView } from "../view-models/today/get-today-view";
import { toDayBlockRef } from "./day-block";
import { getSessionPageView } from "./get-session-page-view";
import { openStudyDay } from "./open-study-day";

const LESSON_COUNT = 480;

async function setup() {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: Array.from({ length: 6 }, () => ({ lessons: 0, size: 80 })) }),
  ]);

  const chapter = library.chapters.at(0);

  if (!chapter) {
    throw new Error("Expected the private library's chapter");
  }

  const lessons = await libraryLessonsFixture(LESSON_COUNT, {
    estimatedMinutes: 3,
    homeChapterId: chapter.id,
  });

  await Promise.all([
    prisma.chapterLesson.createMany({
      data: lessons.map((lesson, position) => ({
        chapterId: chapter.id,
        lessonId: lesson.id,
        position,
      })),
    }),
    prisma.lessonSkill.createMany({
      data: lessons.map((lesson, position) => {
        const skill = library.skills.at(Math.floor(position / 80));

        if (!skill) {
          throw new Error("Expected an owned skill for every library lesson");
        }

        return { lessonId: lesson.id, skillId: skill.id };
      }),
    }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date("2026-09-30T12:00:00Z"),
    dailyMinutes: 60,
    details: { placementDeclined: true },
    settings: {
      baseChoices: library.skills.map((skill) => ({ choice: "deep", skillId: skill.id })),
      startDate: "2026-09-30",
    },
    targetDate: new Date("2027-01-01"),
    timezone: "UTC",
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);

  await expect(
    createGoalPlan({ goalId: goal.id, graph: library.graph, setup: "steps" }),
  ).resolves.toMatchObject({ status: "created" });

  await expect(prisma.planItem.count({ where: { kind: "lesson", planId: plan.id } })).resolves.toBe(
    LESSON_COUNT,
  );

  vi.setSystemTime(new Date("2026-12-20T12:00:00Z"));

  return { goal, plan, user };
}

/** Observes real transactions so the test can detect builds performed while locks are held. */
function observeTransactionBuilds() {
  const state = { depth: 0 };
  const insideBuilds: producer.BuildPlanInput[] = [];
  const transactions: { statements: number; writes: number }[] = [];
  const transaction = prisma.$transaction.bind(prisma);
  const build = producer.buildPlan;

  vi.spyOn(prisma, "$transaction").mockImplementation((async (
    callback: (tx: TransactionClient) => Promise<unknown>,
    options: Parameters<typeof prisma.$transaction>[1],
  ) =>
    transaction(async (tx) => {
      state.depth += 1;

      try {
        const measured = await countDatabaseStatements(() => callback(tx));
        transactions.push({ statements: measured.statements, writes: measured.writes });
        return measured.result;
      } finally {
        state.depth -= 1;
      }
    }, options)) as typeof prisma.$transaction);

  vi.spyOn(producer, "buildPlan").mockImplementation((input) => {
    if (state.depth > 0) {
      insideBuilds.push(input);
    }

    return build(input);
  });

  return { insideBuilds, transactions };
}

describe("opening a real-size selected plan", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("prepares the plan and exact notice before locking, then atomically binds the visible day", async () => {
    const fixture = await setup();
    const input = { goalId: fixture.goal.id, shownDate: "2026-12-20", timeZone: "UTC" };
    const preview = await countDatabaseStatements(() => getSessionPageView(input));
    expect(preview.writes).toBe(0);

    if (preview.result.status !== "unstarted") {
      throw new Error("Expected the actual after-away preview");
    }

    const today = await countDatabaseStatements(() => getTodayView(input));
    expect(today.writes).toBe(0);

    expect(today.result).toMatchObject({ status: "ready", today: { planChange: null } });
    const observed = observeTransactionBuilds();
    const opened = await openStudyDay(input);

    if (opened.status !== "opened") {
      throw new Error(`Expected a persisted selected day, received ${opened.status}`);
    }

    const shown = await getSessionPageView(input);

    if (shown.status !== "ready") {
      throw new Error("Expected the persisted day");
    }

    expect(opened.session.blocks.map(toDayBlockRef)).toStrictEqual(
      shown.session.blocks.map(toDayBlockRef),
    );

    expect(observed.insideBuilds).toHaveLength(0);
    expect(observed.transactions.length).toBeGreaterThan(0);
    expect(observed.transactions.every((counts) => counts.statements <= 32)).toBe(true);

    const savedChange = await prisma.planChange.findFirstOrThrow({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: { planId: fixture.plan.id, status: "applied" },
    });

    const payload = parsePlanChangePayload(savedChange.payload);
    expect(savedChange).toMatchObject({ kind: "missedDays", status: "applied" });
    const afterToday = await getTodayView(input);

    expect(afterToday).toMatchObject({
      status: "ready",
      today: { planChange: { behind: payload.behind, effect: payload.effect, id: savedChange.id } },
    });

    const before = await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } });
    const replay = await openStudyDay(input);
    expect(replay.status).toBe("opened");

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } }),
    ).resolves.toStrictEqual(before);
  });

  it("tells a learner back from weeks away that the date is at risk, and the plan says it", async () => {
    const fixture = await setup();
    const input = { goalId: fixture.goal.id, shownDate: "2026-12-20", timeZone: "UTC" };
    const today = await getTodayView(input);
    expect(today).toMatchObject({ status: "ready", today: { planChange: null } });
    await expect(openStudyDay(input)).resolves.toMatchObject({ status: "opened" });
    const afterToday = await getTodayView(input);
    const notice = afterToday.status === "ready" ? afterToday.today.planChange : null;
    expect(notice).toMatchObject({ behind: { coveredBefore: 1 }, kind: "missedDays" });
    expect(notice?.behind?.coveredAfter ?? 1).toBeLessThan(1);

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } });
    expect.soft(saved.coveredShare ?? 1).toBeLessThan(1);

    const read = await getGoalPlan(fixture.goal.id);

    expect
      .soft(read.status === "ready" ? read.plan.feasibility : null)
      .toMatchObject({ fits: false, timeCovers: false });
  });
});
