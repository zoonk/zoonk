import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession, mockSession } from "../_test-utils/mock-session";
import { markPlansChanged } from "../learner/_utils/mark-learner-changed";
import { seedV2PersonaCopy } from "../seed/seed-v2";
import { openStudyDay } from "../sessions/open-study-day";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { savedPlanSummarySchema } from "./_utils/plan-summary";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlanScreen } from "./get-goal-plan";

const START = new Date("2020-09-28T12:00:00Z");
const RETURN = new Date("2020-10-01T12:00:00Z");

async function saved(planId: string) {
  return prisma.plan.findUniqueOrThrow({
    include: {
      changes: { orderBy: { createdAt: "asc" } },
      items: { orderBy: { position: "asc" } },
    },
    where: { id: planId },
  });
}

async function daysAwayFixture(
  skills: Parameters<typeof planLibraryFixture>[0]["skills"] = [{ lessons: 8 }, { lessons: 6 }],
) {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills });

  const fixture = await unplannedGoalFixture({
    createdAt: START,
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: fixture.goal.id, graph: library.graph });
  await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });
  mockSession(user.id);
  vi.setSystemTime(RETURN);
  return { ...fixture, library, user };
}

describe("the visible Plan after days away, before any learner POST", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => vi.useRealTimers());

  it("shows the moved-forward work and exact backlog while Today keeps its quiet return", async () => {
    const fixture = await daysAwayFixture();
    const before = await saved(fixture.plan.id);

    const read = await countDatabaseStatements(async () => ({
      plan: await getGoalPlanScreen(fixture.goal.id),
      today: await getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
    }));

    expect(read.writes).toBe(0);
    await expect(saved(fixture.plan.id)).resolves.toStrictEqual(before);
    expect(read.result.plan.status).toBe("ready");

    if (read.result.plan.status !== "ready") {
      throw new Error("Expected the actual Plan");
    }

    const plan = read.result.plan.plan;
    expect(plan.status).toMatchObject({ kind: "behind", lessons: 6 });

    expect(plan.phases[0]).toMatchObject({
      chapters: [expect.objectContaining({ lessonsTotal: 14, nextDate: "2020-10-01" })],
      lessonsTotal: 14,
      startDate: "2020-10-01",
    });

    expect(
      plan.week.days.filter((day) => day.date < "2020-10-01").flatMap((day) => day.items),
    ).toStrictEqual([]);

    expect(plan.week.days.find((day) => day.date === "2020-10-01")?.items).toHaveLength(2);

    expect(read.result.today).toMatchObject({
      status: "ready",
      today: { session: { catchUp: null, freshStart: "welcomeBack", status: "unstarted" } },
    });
  });

  it("persists the same visible selected dates only on Open, retaining every lesson ID", async () => {
    const fixture = await daysAwayFixture();
    const preview = await getGoalPlanScreen(fixture.goal.id);

    if (preview.status !== "ready") {
      throw new Error("Expected the actual Plan preview");
    }

    const before = await saved(fixture.plan.id);

    const opened = await openStudyDay({
      goalId: fixture.goal.id,
      shownDate: "2020-10-01",
      timeZone: "UTC",
    });

    expect(opened.status).toBe("opened");
    const after = await saved(fixture.plan.id);

    expect(
      after.items
        .filter((item) => item.kind === "lesson")
        .map((item) => item.id)
        .toSorted(),
    ).toStrictEqual(
      before.items
        .filter((item) => item.kind === "lesson")
        .map((item) => item.id)
        .toSorted(),
    );

    expect(after.changes).toContainEqual(
      expect.objectContaining({ kind: "missedDays", status: "applied" }),
    );

    const dates = new Map(
      after.items.map((item) => [item.id, item.scheduledFor?.toISOString().slice(0, 10)]),
    );

    const shown = preview.plan.week.days.flatMap((day) => day.items);
    expect(shown.length).toBeGreaterThan(0);

    expect(shown.map((item) => ({ date: item.scheduledFor, id: item.id }))).toStrictEqual(
      shown.map((item) => ({ date: item.id ? dates.get(item.id) : undefined, id: item.id })),
    );
  });

  it("shows the returning exam learner's catch-up before Open and persists that same count", async () => {
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
    const copyKey = randomUUID();

    const copy = await seedV2PersonaCopy({
      copyKey,
      email: `catch-up-preview-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: copy.userId } });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: copy.goalId } });

    // This is the real Today/Plan E2E's stayAway operation, on this test's private learner only.
    await Promise.all([
      prisma.planItem.updateMany({
        data: { scheduledFor: new Date("2026-10-12T12:00:00Z") },
        where: { kind: "lesson", planId: plan.id, status: "todo" },
      }),
      prisma.studySession.deleteMany({ where: { goalId: copy.goalId } }),
    ]);

    mockAccountSession({ user });
    const input = { goalId: copy.goalId, timeZone: "UTC" };
    const before = await saved(plan.id);
    expect(before.inputVersion).toBe(plan.inputVersion);

    expect(savedPlanSummarySchema.parse(before.summary).basis).toMatchObject({
      inputVersion: plan.inputVersion,
      planVersion: plan.version,
      studyDay: "2026-10-15",
    });

    const read = await countDatabaseStatements(() => getTodayView(input));
    expect(read.writes).toBe(0);
    await expect(saved(plan.id)).resolves.toStrictEqual(before);

    if (read.result.status !== "ready") {
      throw new Error("Expected the returning learner's actual unopened day");
    }

    expect(read.result.today.session.status).toBe("unstarted");
    expect(read.result.today.session.freshStart).toBeNull();
    expect(read.result.today.session.catchUp?.lessonsLeft).toBeGreaterThan(0);
    expect(read.result.today.session.catchUp?.positions.length).toBeGreaterThan(0);

    const opened = await openStudyDay({ ...input, shownDate: "2026-10-15" });
    expect(opened.status).toBe("opened");
    const after = await getTodayView(input);

    if (after.status !== "ready" || after.today.session.status === "unstarted") {
      throw new Error("Expected the same learner's persisted day");
    }

    expect(after.today.session.freshStart).toBe(read.result.today.session.freshStart);
    expect(read.result.today.progress).toStrictEqual(after.today.progress);

    expect(after.today.progress?.status).toStrictEqual({
      days: 0,
      extraMinutesPerDay: 0,
      kind: "behind",
      lessons: 14,
    });

    const persisted = after.today.session.catchUp;

    if (!persisted || !("blockIds" in persisted)) {
      throw new Error("Expected the same persisted catch-up with real block IDs");
    }

    const { blockIds, ...catchUp } = persisted;
    expect(catchUp).toStrictEqual(read.result.today.session.catchUp);

    expect(blockIds).toStrictEqual(
      after.today.session.blocks
        .filter((block) => persisted.positions.includes(block.position))
        .map((block) => block.id),
    );

    await expect(
      prisma.planChange.count({ where: { kind: "missedDays", planId: plan.id } }),
    ).resolves.toBe(1);
  });

  it("counts newly selected non-exam teaching before Open from the same plan it persists", async () => {
    const fixture = await daysAwayFixture();
    const skill = fixture.library.skills[0];

    if (!skill) {
      throw new Error("Expected the private plan's teaching skill");
    }

    const lesson = await libraryLessonFixture({ estimatedMinutes: 3 });

    await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });
    await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [fixture.plan.id] }));
    const input = { goalId: fixture.goal.id, timeZone: "UTC" };
    const before = await saved(fixture.plan.id);
    const read = await countDatabaseStatements(() => getTodayView(input));
    expect(read.writes).toBe(0);
    await expect(saved(fixture.plan.id)).resolves.toStrictEqual(before);

    const opened = await openStudyDay({ ...input, shownDate: "2020-10-01" });
    expect(opened.status).toBe("opened");
    const after = await getTodayView(input);

    if (read.result.status !== "ready" || after.status !== "ready") {
      throw new Error("Expected both actual plan progress reads");
    }

    expect(read.result.today.progress).toStrictEqual(after.today.progress);
    expect(after.today.progress).toMatchObject({ lessons: { total: 15 }, measure: "lessons" });
  });

  it("counts the fitted lessons of a requeued stand-in before Open exactly as the writer", async () => {
    const fixture = await daysAwayFixture([{ lessons: 2 }, { lessons: 0, size: 6 }]);
    const before = await saved(fixture.plan.id);
    const input = { goalId: fixture.goal.id, timeZone: "UTC" };
    const read = await countDatabaseStatements(() => getTodayView(input));
    expect(read.writes).toBe(0);
    await expect(saved(fixture.plan.id)).resolves.toStrictEqual(before);

    const opened = await openStudyDay({ ...input, shownDate: "2020-10-01" });
    expect(opened.status).toBe("opened");
    const after = await getTodayView(input);

    if (read.result.status !== "ready" || after.status !== "ready") {
      throw new Error("Expected the actual stand-in plan before and after Open");
    }

    expect(read.result.today.progress).toStrictEqual(after.today.progress);
    expect(after.today.progress).toMatchObject({ lessons: { total: 8 }, measure: "lessons" });

    await expect(
      prisma.planItem.findFirstOrThrow({
        where: { chapterId: null, kind: "lesson", lessonId: null, planId: fixture.plan.id },
      }),
    ).resolves.toMatchObject({ lessons: 6 });
  });

  it("counts the real null-ID lesson selected for a placement-only plan's first layout", async () => {
    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({ skills: [{ lessons: 0, size: 1 }, { lessons: 1 }] }),
    ]);

    const settled = library.skills.at(0);
    const lesson = library.lessons.at(0);

    if (!settled || !lesson) {
      throw new Error("Expected the private settled skill and written lesson");
    }

    const { goal, plan } = await unplannedGoalFixture({
      createdAt: START,
      dailyMinutes: 12,
      details: { placementDeclined: true },
      settings: { startDate: "2020-09-28" },
      timezone: "UTC",
      userId: user.id,
    });

    // Supported first-layout input: placement settled one skill before any schedule was shown.
    await prisma.plan.update({ data: { graph: library.graph }, where: { id: plan.id } });

    await planItemFixture({
      completedAt: START,
      planId: plan.id,
      skillId: settled.id,
      status: "testedOut",
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);
    const input = { goalId: goal.id, timeZone: "UTC" };
    const before = await saved(plan.id);
    const read = await countDatabaseStatements(() => getTodayView(input));
    expect(read.writes).toBe(0);
    await expect(saved(plan.id)).resolves.toStrictEqual(before);

    if (read.result.status !== "ready") {
      throw new Error("Expected the actual first-layout preview");
    }

    const selected = read.result.today.session.blocks.filter((block) => block.kind === "learn");
    expect(selected).toHaveLength(1);

    expect(selected[0]).toMatchObject({
      lessonId: lesson.id,
      planItemId: null,
      planItemKey: `lesson:${lesson.id}`,
      reinforcement: false,
      status: "pending",
    });

    expect(read.result.today.progress).toMatchObject({ lessons: { today: 1, total: 2 } });
    const opened = await openStudyDay({ ...input, shownDate: "2020-09-28" });
    expect(opened.status).toBe("opened");
    const after = await getTodayView(input);

    if (after.status !== "ready") {
      throw new Error("Expected the same persisted first day");
    }

    expect(read.result.today.progress).toStrictEqual(after.today.progress);
    expect(after.today.progress).toMatchObject({ lessons: { today: 1, total: 2 } });

    expect(after.today.session.blocks.filter((block) => block.kind === "learn")).toStrictEqual([
      expect.objectContaining({
        lessonId: selected[0]?.lessonId,
        planItemId: expect.any(String),
        planItemKey: selected[0]?.planItemKey,
      }),
    ]);
  });
});
