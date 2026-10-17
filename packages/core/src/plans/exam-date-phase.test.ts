import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A Monday in 2020, before the learning events other tests write. */
const START = new Date("2020-09-28T12:00:00Z");

/** Two weeks into the plan's foundations, a year from the exam. */
const TWO_WEEKS_IN = new Date("2020-10-12T12:00:00Z");

type Phase = { endDate: string | null; kind: string; startDate: string | null };

async function readPhases(planId: string): Promise<Phase[]> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });

  return (plan.phases as Phase[]).map(({ endDate, kind, startDate }) => ({
    endDate,
    kind,
    startDate,
  }));
}

/*
 * Walk: Ana moved ENEM from 400 days away to 36, two weeks into her foundations. The exam's
 * phases were laid out again from the plan's start, so her foundations had ended two days earlier
 * with 4 of their lessons done, and Plan showed them finished.
 */
describe("an exam moved closer while the learner is in a phase", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps that phase open from today, and keeps its dates the next day", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      skills: [
        { area: "Math", lessons: 8, weight: 3 },
        { area: "Language", lessons: 8, weight: 3 },
      ],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 30,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2021-09-28T00:00:00Z"),
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    vi.setSystemTime(TWO_WEEKS_IN);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setTargetDate", targetDate: "2020-11-17" }], timeZone: "UTC" },
    });

    expect(result.status).not.toBe("invalid");

    const phases = await readPhases(plan.id);

    expect(phases[0]).toMatchObject({ kind: "foundations", startDate: "2020-09-28" });
    expect(phases[0]?.endDate && phases[0].endDate >= "2020-10-12").toBe(true);
    expect(phases.at(-1)).toMatchObject({ endDate: "2020-11-16", kind: "finalStretch" });

    vi.setSystemTime(new Date("2020-10-13T12:00:00Z"));
    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });

    await expect(readPhases(plan.id)).resolves.toStrictEqual(phases);
  });
});
