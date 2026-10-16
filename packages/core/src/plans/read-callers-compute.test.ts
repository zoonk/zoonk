import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { unplannedCheckpointFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChallenge } from "../checkpoints/get-challenge";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { getLearnerSummary } from "../learner/summary/get-learner-summary";
import { admitPlanLessons } from "../lookahead/speculative-lessons";
import { listGoalMindMaps } from "../mind-maps/list-goal-mind-maps";
import { lapsedDayFixture, readLapsedDayState } from "../sessions/_test-utils/entitlement-lapse";
import {
  SESSION_NOW,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { buildSessionBlocks } from "../sessions/session-builder";
import { createGoalPlan } from "./create-goal-plan";
import { buildPlan } from "./planner/build-plan";

// Call through both producers: PostgreSQL and the behavior under test remain real.
vi.mock("./planner/build-plan", { spy: true });
vi.mock("../sessions/session-builder", { spy: true });

async function savedPlan() {
  const user = await userFixture();
  const fixture = await unplannedCheckpointFixture({ userId: user.id });
  mockSession(user.id);
  await createGoalPlan({ goalId: fixture.goal.id, graph: fixture.graph, setup: "steps" });
  vi.mocked(buildPlan).mockClear();
  vi.mocked(buildSessionBlocks).mockClear();
  return { ...fixture, user };
}

describe("row-5 callers read their saved artifacts", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("the empty mind-map caller names its current chapter without a plan build", async () => {
    const { chapter, goal } = await savedPlan();
    const maps = await listGoalMindMaps({ goalId: goal.id });

    expect(maps).toMatchObject({
      mindMaps: {
        chapters: [],
        nextChapter: { chapterId: chapter.id, lessonsLeft: 4, title: chapter.title },
      },
      status: "ready",
    });

    expect(buildPlan).toHaveBeenCalledTimes(0);
  });

  it("an admitted child checks its selected lesson without a plan build", async () => {
    const { goal, lessons, user } = await savedPlan();
    const lessonIds = lessons.map((lesson) => lesson.id);

    await prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: user.id });
      await tx.goal.update({ data: { dailyMinutes: 18 }, where: { id: goal.id } });
    });

    const admitted = await admitPlanLessons({ goalId: goal.id, lessonIds });

    expect(admitted).toStrictEqual(lessonIds);
    expect(buildPlan).toHaveBeenCalledTimes(0);
  });

  it("a due challenge GET reads its offer without rebuilding the day", async () => {
    const user = await userFixture();

    const { goal, plan, planItems } = await sessionGoalFixture({
      itemsPerSkill: 10,
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    await prisma.planItem.updateMany({
      data: { completedAt: SESSION_NOW, status: "done" },
      where: { id: { in: planItems.map((item) => item.id) } },
    });

    const boss = await checkpointItemFixture({ kind: "boss", planId: plan.id, position: 3 });
    mockSession(user.id);
    vi.mocked(buildPlan).mockClear();
    vi.mocked(buildSessionBlocks).mockClear();

    const read = await countDatabaseStatements(() =>
      getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    );

    expect(read.result).toMatchObject({
      challenge: { minutes: null, questions: null, status: "ready", topics: [] },
      status: "ready",
    });

    expect(read.writes).toBe(0);
    expect(buildPlan).toHaveBeenCalledTimes(0);
    expect(buildSessionBlocks).toHaveBeenCalledTimes(0);
  });

  it("a lapsed summary previews the free lesson Open saves from the saved plan, without writing", async () => {
    const day = await lapsedDayFixture();
    const before = await readLapsedDayState(day.user.id);
    vi.mocked(buildPlan).mockClear();
    vi.mocked(buildSessionBlocks).mockClear();

    const read = await countDatabaseStatements(() => getLearnerSummary());

    expect(read.writes).toBe(0);
    // As Today does, it builds the lapsed day's free blocks once from the saved plan (its input's
    // empty-day check builds them too); it never builds a plan.
    expect(buildPlan).toHaveBeenCalledTimes(0);
    expect(buildSessionBlocks).toHaveBeenCalledTimes(2);

    expect(read.result?.today).toMatchObject({
      blocksLeft: 1,
      next: { sessionId: day.sessionId, title: day.planItems.at(-1)?.titleSnapshot },
    });

    await expect(readLapsedDayState(day.user.id)).resolves.toStrictEqual(before);
  });

  it("an active Plus call day's summary plans no replacement", async () => {
    const day = await lapsedDayFixture();

    await prisma.subscription.updateMany({
      data: { status: "active" },
      where: { referenceId: day.user.id },
    });

    vi.mocked(buildPlan).mockClear();
    vi.mocked(buildSessionBlocks).mockClear();

    const read = await countDatabaseStatements(() => getLearnerSummary());

    expect(read.writes).toBe(0);
    expect(buildPlan).toHaveBeenCalledTimes(0);
    expect(buildSessionBlocks).toHaveBeenCalledTimes(0);
    expect(read.result?.today?.next?.sessionId).toBe(day.sessionId);
  });
});
