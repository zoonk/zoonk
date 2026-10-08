import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
} from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
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
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  return { goal, plan };
}

describe(loadTodayPlanChange, () => {
  it("says nothing when the plan didn't change", async () => {
    const { goal } = await setup();
    await expect(loadTodayPlanChange({ goalId: goal.id, now: NOW })).resolves.toBeNull();
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
        payload: { operations: [{ kind: "setDailyMinutes", minutes: 20 }], source: "planEdit" },
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

    // A change read from the learner's words is said from what it does, not the model's words.
    await expect(loadTodayPlanChange({ goalId: goal.id, now: NOW })).resolves.toMatchObject({
      id: newest.id,
      operations: [{ kind: "setDailyMinutes", minutes: 20 }],
      reason: null,
      source: "planEdit",
      status: "proposed",
    });
  });

  it("brings up lessons earlier days left only when falling behind puts the date at risk", async () => {
    const { goal, plan } = await setup();

    const behind = {
      canFocus: false,
      coveredAfter: 0.8,
      coveredBefore: 1,
      currentMinutes: 30,
      dailyMinutes: 45,
      fullDepth: true,
      measure: "goal",
    };

    await planChangeFixture({
      createdAt: hoursAgo(2),
      kind: "missedDays",
      payload: { behind: null, days: 1, source: "system" },
      planId: plan.id,
      status: "applied",
    });

    await expect(loadTodayPlanChange({ goalId: goal.id, now: NOW })).resolves.toBeNull();

    const atRisk = await planChangeFixture({
      createdAt: hoursAgo(1),
      kind: "missedDays",
      payload: { behind, days: 2, source: "system" },
      planId: plan.id,
      status: "applied",
    });

    await expect(loadTodayPlanChange({ goalId: goal.id, now: NOW })).resolves.toMatchObject({
      behind,
      id: atRisk.id,
      kind: "missedDays",
    });
  });

  it("carries the newest automatic change of the last day until it's seen", async () => {
    const { goal, plan } = await setup();

    const [rebalance] = await Promise.all([
      planChangeFixture({
        createdAt: hoursAgo(6),
        kind: "edited",
        payload: {
          operations: [{ areas: ["Science"], kind: "focusAreas" }],
          source: "preparation",
          versionAfter: plan.version,
        },
        planId: plan.id,
        status: "applied",
      }),
      // The learner's own edit, a sharper estimate and an older change say nothing new.
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
        payload: { days: 1, source: "system" },
        planId: plan.id,
        status: "applied",
      }),
    ]);

    await expect(loadTodayPlanChange({ goalId: goal.id, now: NOW })).resolves.toMatchObject({
      canUndo: true,
      chapterTitle: null,
      id: rebalance.id,
      kind: "edited",
      source: "preparation",
    });

    // "Got it" takes it off Today.
    await planChangeFixture({
      createdAt: hoursAgo(4),
      kind: "missedDays",
      payload: { days: 1, seenAt: hoursAgo(3).toISOString(), source: "system" },
      planId: plan.id,
      status: "applied",
    });

    await expect(loadTodayPlanChange({ goalId: goal.id, now: NOW })).resolves.toMatchObject({
      id: rebalance.id,
    });
  });

  it("names the chapter a test-out skipped, only when its lessons all come from one", async () => {
    const { goal, plan } = await setup();

    const [circuits, optics] = await Promise.all([
      libraryChapterFixture({ title: "Electric circuits" }),
      libraryChapterFixture({ title: "Optics" }),
    ]);

    const items = await Promise.all(
      [circuits, circuits, optics].map((chapter, position) =>
        planItemFixture({ chapterId: chapter.id, planId: plan.id, position, status: "testedOut" }),
      ),
    );

    const ids = items.map((item) => item.id);

    const oneChapter = await planChangeFixture({
      createdAt: hoursAgo(2),
      kind: "testedOut",
      payload: { planItemIds: ids.slice(0, 2), source: "system", versionAfter: plan.version },
      planId: plan.id,
      status: "applied",
    });

    await expect(loadTodayPlanChange({ goalId: goal.id, now: NOW })).resolves.toMatchObject({
      canUndo: true,
      chapterTitle: "Electric circuits",
      id: oneChapter.id,
      lessonsSkipped: 2,
    });

    const twoChapters = await planChangeFixture({
      createdAt: hoursAgo(1),
      kind: "testedOut",
      // The plan moved on since, so this one can't be undone any more.
      payload: { planItemIds: ids.slice(1), source: "system", versionAfter: plan.version - 1 },
      planId: plan.id,
      status: "applied",
    });

    await expect(loadTodayPlanChange({ goalId: goal.id, now: NOW })).resolves.toMatchObject({
      canUndo: false,
      chapterTitle: null,
      id: twoChapters.id,
    });
  });
});
