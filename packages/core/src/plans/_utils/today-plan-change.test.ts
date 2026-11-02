import { prisma } from "@zoonk/db";
import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadTodayPlanChange } from "./today-plan-change";

const NOW = new Date("2026-10-05T12:00:00Z");
const HOUR_MS = 60 * 60 * 1000;

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * HOUR_MS);
}

async function setup() {
  const user = await userFixture();
  const goal = await goalFixture({ timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  return { goal, plan };
}

describe(loadTodayPlanChange, () => {
  it("says nothing when the plan didn't change", async () => {
    const { goal } = await setup();
    await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toBeNull();
  });

  it("carries the newest proposal waiting for an OK, whoever proposed it, before any change", async () => {
    const { goal, plan } = await setup();

    const [, newest] = await Promise.all([
      planChangeFixture({
        createdAt: hoursAgo(5),
        kind: "edited",
        payload: { operations: [], source: "memory" },
        planId: plan.id,
        status: "proposed",
      }),
      planChangeFixture({
        createdAt: hoursAgo(3),
        kind: "edited",
        payload: {
          effect: { endDateAfter: null, endDateBefore: null, lessonsAdded: 0, lessonsRemoved: 3 },
          operations: [{ kind: "setDailyMinutes", minutes: 20 }],
          previewBasis: {
            inputVersion: plan.inputVersion,
            planVersion: plan.version,
            studyDay: "2026-10-05",
            timeZone: "UTC",
          },
          source: "planEdit",
        },
        planId: plan.id,
        reason: "Twenty minutes a day keeps you on track.",
        status: "proposed",
      }),
      planChangeFixture({
        createdAt: hoursAgo(1),
        kind: "missedDays",
        payload: { days: 2, source: "system" },
        planId: plan.id,
        status: "applied",
      }),
    ]);

    await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toMatchObject({
      id: newest.id,
      operations: [{ kind: "setDailyMinutes", minutes: 20 }],
      reason: null,
      source: "planEdit",
      status: "proposed",
    });
  });

  it("brings up lessons earlier days left only when falling behind puts the date at risk", async () => {
    const { goal, plan } = await setup();

    const facts = {
      canFocus: false,
      coveredAfter: 0.8,
      coveredBefore: 1,
      currentMinutes: 30,
      measure: "goal",
    };

    const behind = { ...facts, dailyMinutes: 45, fullDepth: true };

    await planChangeFixture({
      createdAt: hoursAgo(2),
      kind: "missedDays",
      payload: { behind: null, days: 1, source: "system" },
      planId: plan.id,
      status: "applied",
    });

    await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toBeNull();

    const atRisk = await planChangeFixture({
      createdAt: hoursAgo(1),
      kind: "missedDays",
      payload: { behind, days: 2, source: "system" },
      planId: plan.id,
      status: "applied",
    });

    const change = await loadTodayPlanChange({ goal, now: NOW });

    expect(change).toMatchObject({ id: atRisk.id, kind: "missedDays" });
    expect(change?.behind).toStrictEqual(facts);
  });

  it("leaves a settling made once the goal's date came to the day line", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      targetDate: new Date("2026-10-04T00:00:00Z"),
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id });

    await planChangeFixture({
      createdAt: hoursAgo(2),
      kind: "missedDays",
      payload: {
        behind: {
          canFocus: false,
          coveredAfter: 0.8,
          coveredBefore: 1,
          currentMinutes: 30,
          measure: "goal",
        },
        days: 3,
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 0,
          lessonsRemoved: 6,
          topicsLeftOut: [{ area: "Física", topics: ["Incerteza"] }],
        },
        source: "system",
      },
      planId: plan.id,
      status: "applied",
    });

    await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toBeNull();

    const ahead = await prisma.goal.update({
      data: { targetDate: new Date("2026-10-20T00:00:00Z") },
      where: { id: goal.id },
    });

    await expect(loadTodayPlanChange({ goal: ahead, now: NOW })).resolves.toMatchObject({
      kind: "missedDays",
    });
  });

  it.each(["missedDays", "resumed"] as const)(
    "keeps a %s change quiet, even one that moves topics in or out of the plan",
    async (kind) => {
      const { goal, plan } = await setup();

      await planChangeFixture({
        createdAt: hoursAgo(1),
        kind,
        payload: {
          behind: null,
          days: 1,
          effect: {
            endDateAfter: null,
            endDateBefore: null,
            lessonsAdded: 212,
            lessonsRemoved: 194,
            phaseEnds: [{ after: "2026-10-24", before: "2026-10-21", name: "Basics" }],
            topicsLeftOut: [{ area: "Natureza", topics: ["Genética"] }],
          },
          source: "system",
        },
        planId: plan.id,
        status: "applied",
      });

      await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toBeNull();
    },
  );

  it("keeps a closer estimate quiet, even one that leaves lessons out", async () => {
    const { goal, plan } = await setup();

    await planChangeFixture({
      createdAt: hoursAgo(1),
      kind: "estimateUpdated",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 0,
          lessonsLeftOut: [{ area: "Science", title: "Ecology basics" }],
          lessonsRemoved: 6,
          topicsLeftOut: [{ area: "Science", topics: ["Ecology"] }],
        },
        source: "system",
      },
      planId: plan.id,
      status: "applied",
    });

    await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toBeNull();
  });

  it.each([
    { added: 0, removed: 0 },
    { added: 0, removed: 1 },
    { added: 1, removed: 0 },
    { added: 4, removed: 4 },
  ])(
    "keeps a legacy small estimate notice quiet ($added added, $removed removed)",
    async ({ added, removed }) => {
      const { goal, plan } = await setup();

      await planChangeFixture({
        createdAt: hoursAgo(1),
        kind: "estimateUpdated",
        payload: {
          effect: {
            endDateAfter: null,
            endDateBefore: null,
            lessonsAdded: added,
            lessonsRemoved: removed,
            topicsLeftOut: [{ area: "Science", topics: ["Ecology"] }],
          },
          source: "system",
        },
        planId: plan.id,
        status: "applied",
      });

      await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toBeNull();
    },
  );

  it("carries falling behind of the last day until it's answered", async () => {
    const { goal, plan } = await setup();

    const behind = {
      canFocus: false,
      coveredAfter: 0.8,
      coveredBefore: 1,
      currentMinutes: 30,
      measure: "goal",
    };

    const [atRisk] = await Promise.all([
      planChangeFixture({
        createdAt: hoursAgo(6),
        kind: "missedDays",
        payload: { behind, days: 1, source: "system" },
        planId: plan.id,
        status: "applied",
      }),
      planChangeFixture({
        createdAt: hoursAgo(2),
        kind: "edited",
        payload: { operations: [{ kind: "setDailyMinutes", minutes: 30 }], source: "learner" },
        planId: plan.id,
        status: "applied",
      }),
      planChangeFixture({
        createdAt: hoursAgo(1),
        kind: "estimateUpdated",
        payload: { source: "system" },
        planId: plan.id,
        status: "applied",
      }),
      planChangeFixture({
        createdAt: hoursAgo(30),
        kind: "missedDays",
        payload: { behind, days: 1, source: "system" },
        planId: plan.id,
        status: "applied",
      }),
    ]);

    await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toMatchObject({
      id: atRisk.id,
      kind: "missedDays",
    });

    await prisma.planChange.update({
      data: { payload: { behind, days: 1, seenAt: hoursAgo(1).toISOString(), source: "system" } },
      where: { id: atRisk.id },
    });

    await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toBeNull();
  });

  it.each(["relearn", "testedOut"] as const)(
    "keeps a %s change quiet: the learner's answers made it",
    async (kind) => {
      const { goal, plan } = await setup();

      await planChangeFixture({
        createdAt: hoursAgo(1),
        kind,
        payload: { planItemIds: [], source: "system", versionAfter: plan.version },
        planId: plan.id,
        status: "applied",
      });

      await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toBeNull();
    },
  );
});
