import * as database from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { commitPlan } from "../plans/_utils/commit-plan";
import { findOwnedPlan } from "../plans/_utils/owned-plan";
import { loadPlanAtToken } from "../plans/_utils/plan-token";
import { computePlan } from "../plans/_utils/replan";
import { withPlanRetry } from "../plans/plan-conflict";
import { lapsedDayFixture, readLapsedDayState } from "./_test-utils/entitlement-lapse";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { openStudyDay } from "./open-study-day";

async function unopenedDayFixture() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ goal: { dailyMinutes: 30 }, userId: user.id });
  mockAccountSession({ user });
  return { ...fixture, user };
}

const { prisma } = database;

const basisRead = vi.hoisted((): { before?: () => Promise<void>; goalId?: string } => ({}));

// Delay the real basis read for this goal only. Other tests can still read and write their plans.
vi.mock("@zoonk/db", async (load) => {
  const db = await load<typeof database>();

  return {
    ...db,
    prisma: db.prisma.$extends({
      query: {
        plan: {
          async findUnique({ args, query }) {
            if (args.where.goalId === basisRead.goalId && args.select?.inputVersion) {
              const before = basisRead.before;
              basisRead.before = undefined;
              await before?.();
            }

            return query(args);
          },
        },
      },
    }),
  };
});

async function changeBeforeBasis({
  goalId,
  userId,
  read = () => openStudyDay({ goalId, shownDate: "2026-09-30", timeZone: "UTC" }),
}: {
  goalId: string;
  userId: string;
  read?: () => Promise<unknown>;
}) {
  const write = vi.fn(() =>
    prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId });
      await tx.goal.update({ data: { dailyMinutes: 5 }, where: { id: goalId } });
    }),
  );

  basisRead.goalId = goalId;
  basisRead.before = write;

  try {
    const result = await read();
    expect(write).toHaveBeenCalledOnce();
    return result;
  } finally {
    basisRead.goalId = undefined;
    basisRead.before = undefined;
  }
}

describe("Open binds the goal snapshot to the later plan basis", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("loads a writer's goal only after the token it will commit", async () => {
    const { goal, user } = await unopenedDayFixture();

    const result = await changeBeforeBasis({
      goalId: goal.id,
      read: () => findOwnedPlan({ goalId: goal.id }),
      userId: user.id,
    });

    expect(result).toMatchObject({ context: { goal: { dailyMinutes: 5 } }, status: "ready" });
  });

  it("retries a computed writer from fresh inputs after losing its token", async () => {
    const { goal, user } = await unopenedDayFixture();
    const attempts: number[] = [];

    await withPlanRetry(async () => {
      const context = await loadPlanAtToken(goal.id);
      expect(context).not.toBeNull();
      attempts.push(context!.goal.dailyMinutes);
      const computed = await computePlan({ context: context!, mode: "automatic" });

      if (attempts.length === 1) {
        await prisma.$transaction(async (tx) => {
          await markLearnerChanged(tx, { planInputs: true, userId: user.id });
          await tx.goal.update({ data: { dailyMinutes: 5 }, where: { id: goal.id } });
        });
      }

      await commitPlan({ change: null, computed, context: context! });
    });

    expect(attempts).toStrictEqual([30, 5]);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 5,
    });
  });

  it.each(["first day", "entitlement refill"])(
    "retries stale %s admission when minutes change before the basis read",
    async (kind) => {
      const day = kind === "first day" ? await unopenedDayFixture() : await lapsedDayFixture();
      await prisma.goal.update({ data: { dailyMinutes: 30 }, where: { id: day.goal.id } });
      const before = await readLapsedDayState(day.user.id);
      const opening = await changeBeforeBasis({ goalId: day.goal.id, userId: day.user.id });
      expect(opening).toMatchObject({ status: "opened" });
      const after = await readLapsedDayState(day.user.id);
      expect(after.sessions).toHaveLength(1);

      expect(
        (after.sessions[0]?.plannedMinutes ?? 0) - (before.sessions[0]?.plannedMinutes ?? 0),
      ).toBeLessThanOrEqual(5);

      expect(after.plans[0]?.inputVersion).toBe(before.plans[0]!.inputVersion + 2);

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: day.goal.id } }),
      ).resolves.toMatchObject({ dailyMinutes: 5 });
    },
  );
});
