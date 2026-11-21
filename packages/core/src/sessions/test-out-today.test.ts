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
import { decidePlanChange } from "../plans/decide-plan-change";
import { getTodayStudySession } from "./_test-utils/open-today";
import { getStudySession } from "./get-study-session";
import { startStudyBlock } from "./start-study-block";

/** Predates other tests' learning events so their pace cannot affect the fixture. */
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

  it("preserves the active lesson and pending blocks, even after midnight", async () => {
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

    const before = await readToday(goal.id);
    const readSaved = () => getStudySession({ input: { timeZone: "UTC" }, sessionId: today.id });
    const shown = await readSaved();
    const known = library.skills[0]?.id ?? "";

    const { items } = await loadGoalPlan(goal.id);

    await markPlanItemsTestedOut({
      goalId: goal.id,
      items,
      knownSkillIds: new Set([known]),
      testedOutAt: new Date(),
      timeZone: "UTC",
    });

    const blocks = () =>
      prisma.studySessionBlock.findMany({
        orderBy: { position: "asc" },
        where: { sessionId: today.id },
      });

    expect(before.blocks.find((block) => block.id === opened?.id)?.status).toBe("active");
    expect(before.blocks.some((block) => block.status === "pending")).toBe(true);

    await expect(blocks()).resolves.toStrictEqual(before.blocks);

    vi.setSystemTime(new Date("2020-09-29T00:01:00Z"));

    expect(shown.status).toBe("ready");

    await expect(readSaved()).resolves.toMatchObject({
      session: { blocks: shown.status === "ready" ? shown.session.blocks : [] },
      status: "ready",
    });

    await expect(blocks()).resolves.toStrictEqual(before.blocks);
  });

  it("restores the plan while keeping the shown day when the learner undoes it", async () => {
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

    const before = await readToday(goal.id);
    const { items } = await loadGoalPlan(goal.id);

    const { changeId } = await markPlanItemsTestedOut({
      goalId: goal.id,
      items,
      knownSkillIds: new Set([library.skills[0]?.id ?? ""]),
      testedOutAt: new Date(),
      timeZone: "UTC",
    });

    await decidePlanChange({
      changeId: changeId ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    const after = await readToday(goal.id);
    const shape = (block: (typeof before.blocks)[number]) => [block.id, block.status];

    expect(after.blocks.map((block) => shape(block))).toStrictEqual(
      before.blocks.map((block) => shape(block)),
    );

    expect(after.missions).toStrictEqual(before.missions);

    await expect(
      prisma.planItem.count({ where: { plan: { goalId: goal.id }, status: "testedOut" } }),
    ).resolves.toBe(0);
  });
});
