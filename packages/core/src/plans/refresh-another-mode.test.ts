import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const NOW = new Date("2020-09-28T12:00:00Z");

/**
 * A learn plan a forced run made today (`createGoalPlan`), saved without its last lesson: the plan
 * as its run laid it out, which planning it again lays out another way.
 */
async function setup() {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 6 }, { lessons: 6 }] });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const last = await prisma.planItem.findFirstOrThrow({
    orderBy: { position: "desc" },
    where: { kind: "lesson", planId: plan.id },
  });

  await prisma.planItem.delete({ where: { id: last.id } });

  return { goal, plan };
}

function readItems(planId: string) {
  return prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId } });
}

/*
 * R32: a run with nothing new keeps the plan the last run saved, however that run laid it out.
 * Planned again in another mode, a Câmara plan moved 500 items after a study day and an OAB plan
 * 640 after the learner gave it more time.
 */
describe("a plan the last run laid out another way", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The refresh plans from what the saved plan was planned from (`getPlanInputsKey`), though it
  // now reads today's session as shown, which the run that saved the plan didn't.
  it("stays as it is through a refresh with nothing new", async () => {
    const { goal, plan } = await setup();
    await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
    const before = await readItems(plan.id);

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unchanged",
    });

    await expect(readItems(plan.id)).resolves.toStrictEqual(before);
  });

  // Building a day only settles what earlier days left (`settleOnly`), even when nothing says what
  // the plan was planned from: a career plan's first open of Today added lessons and moved its last
  // weeks.
  it("stays as it is when the learner opens Today with nothing to settle", async () => {
    const { goal, plan } = await setup();
    await prisma.plan.update({ data: { inputsKey: null }, where: { id: plan.id } });
    const before = await readItems(plan.id);

    await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

    await expect(readItems(plan.id)).resolves.toStrictEqual(before);
  });
});
