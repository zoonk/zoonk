import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut } from "../learner/_utils/known-skills";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getTodayStudySession } from "./get-today-study-session";
import { startStudyBlock } from "./start-study-block";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A Monday in 2020, before the learning events other tests write, so their pace stays out. */
const MONDAY = new Date("2020-09-28T12:00:00Z");

async function readToday(goalId: string) {
  const finishDeferredWork = runDeferredWork();
  const result = await getTodayStudySession({ goalId, timeZone: "UTC" });
  await finishDeferredWork();

  if (result.status !== "ready") {
    throw new Error(`Expected today's session, got ${result.status}`);
  }

  return prisma.studySession.findUniqueOrThrow({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { id: result.session.id },
  });
}

describe("a chapter test passed in the middle of a lesson", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes the lessons it covered off today, the one open too, and goes on with the next", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 3 }, { lessons: 3 }] });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 30,
      settings: { startDate: "2020-09-28" },
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    const today = await readToday(goal.id);
    const opened = today.blocks.find((block) => block.kind === "learn");

    await startStudyBlock({
      blockId: opened?.id ?? "",
      input: { timeZone: "UTC" },
      sessionId: today.id,
    });

    const known = library.skills[0]?.id ?? "";
    const coveredLessons = new Set(library.lessons.slice(0, 3).map((lesson) => lesson.id));

    const { items } = await loadGoalPlan(goal.id);

    await markPlanItemsTestedOut({
      goalId: goal.id,
      items,
      knownSkillIds: new Set([known]),
      testedOutAt: new Date(),
      timeZone: "UTC",
    });

    const after = await readToday(goal.id);

    const open = after.blocks.filter(
      (block) => block.status === "active" || block.status === "pending",
    );

    expect(after.id).toBe(today.id);
    expect(after.blocks.find((block) => block.id === opened?.id)?.status).toBe("skipped");
    expect(open.some((block) => block.lessonId && coveredLessons.has(block.lessonId))).toBe(false);

    const next = open.find((block) => block.kind === "learn");
    expect(library.lessons.slice(3).map((lesson) => lesson.id)).toContain(next?.lessonId);
  });
});
