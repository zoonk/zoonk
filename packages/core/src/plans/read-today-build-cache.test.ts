import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { readBuiltPlan } from "./_utils/read-built-plan";
import { createGoalPlan } from "./create-goal-plan";

// Only observe the real Next cache leaf; persistence and the producer are unchanged.
vi.mock("./_utils/read-built-plan", async (importOriginal) => {
  const actual = await importOriginal<{ readBuiltPlan: typeof readBuiltPlan }>();
  return { ...actual, readBuiltPlan: vi.fn(actual.readBuiltPlan) };
});

const START = new Date("2020-09-28T12:00:00Z");
const RETURN = new Date("2020-10-01T12:00:00Z");

async function setup() {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: START,
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);
  vi.setSystemTime(RETURN);
  return { goal, plan, user };
}

function readArgs(goalId: string) {
  const args = vi
    .mocked(readBuiltPlan)
    .mock.calls.findLast(([call]) => call.input.goalId === goalId)?.[0];

  if (!args) {
    throw new Error("Unopened Today must reach the existing shared pure-build cache");
  }

  return args;
}

describe("Today shares only its pure build with complete fresh keys", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    vi.mocked(readBuiltPlan).mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("keys the actual unopened Today build by its fresh plan and entitlement scope", async () => {
    const { goal, plan, user } = await setup();
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    const read = await countDatabaseStatements(() =>
      getTodayView({ goalId: goal.id, timeZone: "UTC" }),
    );

    expect(read.writes).toBe(0);

    expect(read.result).toMatchObject({
      status: "ready",
      today: { session: { status: "unstarted" } },
    });

    expect(readArgs(goal.id)).toMatchObject({
      scope: {
        entitlement: "free",
        inputVersion: before.inputVersion,
        planId: plan.id,
        planVersion: before.version,
        timeZone: "UTC",
      },
      userId: user.id,
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await getTodayView({ goalId: goal.id, timeZone: "UTC" });

    expect(readArgs(goal.id)).toMatchObject({ scope: { entitlement: "plus" } });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      before,
    );
  });
});
