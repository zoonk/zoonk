import { prisma } from "@zoonk/db";
import { goalWithBasesFixture } from "@zoonk/testing/fixtures/plan-bases";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import {
  AHEAD_START,
  aheadPlanFixture,
  readPlanScreen,
  studyFaster,
} from "./_test-utils/ahead-plan";
import { changeGoalPlan } from "./change-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { refreshGoalPlan } from "./refresh-goal-plan";

function countLessonsLeft(planId: string) {
  return prisma.planItem.count({
    where: { kind: { in: ["chapter", "lesson"] }, planId, status: "todo" },
  });
}

/*
 * Pedro moved his date a week closer, which left his last two phases out, then studied ahead.
 * His 15 minutes a day now covered everything, yet the Plan offered "10 min a day covers
 * everything" (less time, framed as more), and after he won a challenge a refresh added 4 lessons
 * to a plan whose lessons were all done, so it never reached "Finished". The owner's call: never
 * add lessons behind the learner's back once they're all done, and never offer less time framed
 * as covering more. What their own time fits comes as the Plan's suggestion, with its diff, Apply
 * and Undo (Todoist and Linear never add tasks on their own either).
 */
describe("lessons the learner's own time fits", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHEAD_START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("are offered at the learner's time once it covers what their date left out", async () => {
    const { goal, plan, user } = await aheadPlanFixture({ dailyMinutes: 15, faster: true });
    const before = await readPlanScreen();

    // The plan leaves topics out, and his own time planned again doesn't hold every lesson the
    // Library wrote by his date either: the offer comes because every lesson the plan holds is done.
    expect(before?.feasibility).toMatchObject({ coreFits: false, fits: false, timeCovers: false });

    // The change brings Stocks back, and says what it is: his time still doesn't hold every lesson.
    expect(before?.fitOffer).toMatchObject({
      effect: { topicsAdded: [{ area: "Stocks" }] },
      fits: false,
      operations: [{ kind: "fitLessons" }],
    });

    expect(before?.fitOffer?.effect.lessonsAdded).toBeGreaterThan(0);

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, { planInputs: true, userId: user.id }),
    );

    const afterAnswer = await readPlanScreen();
    expect(afterAnswer?.fitOffer).toStrictEqual(before?.fitOffer);
    expect(afterAnswer?.fitOffer?.canApply).toBe(true);

    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "fitLessons" }] },
    });

    expect(applied).toMatchObject({
      change: { effect: { lessonsAdded: before?.fitOffer?.effect.lessonsAdded } },
      status: "applied",
    });

    await expect(countLessonsLeft(plan.id)).resolves.toBeGreaterThan(0);

    // After Apply the Plan says what the offer said: every topic is in, and whether it all fits.
    await expect(readPlanScreen()).resolves.toMatchObject({
      feasibility: { coreFits: true, fits: before?.fitOffer?.fits },
      fitOffer: null,
    });

    await decidePlanChange({
      changeId: applied.status === "applied" ? (applied.change?.id ?? "") : "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    // Undo puts the plan back, and the offer with it (today's session, built by Apply, now keeps
    // its day as shown, so it may fit a lesson less today).
    await expect(countLessonsLeft(plan.id)).resolves.toBe(0);
    const undone = await readPlanScreen();

    expect(undone?.fitOffer).toMatchObject({
      effect: { topicsAdded: before?.fitOffer?.effect.topicsAdded },
      operations: [{ kind: "fitLessons" }],
    });
  });

  it("never come into a plan whose lessons are all done after a session: they're offered", async () => {
    // Ten days away, studying ahead at a faster pace leaves room the session's refresh would fill.
    const { goal, plan, user } = await aheadPlanFixture({ dailyMinutes: 15, days: 10 });

    const saved = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { planId: plan.id },
    });

    await expect(countLessonsLeft(plan.id)).resolves.toBe(0);

    await studyFaster({ planId: plan.id, userId: user.id });

    await expect(refreshGoalPlan({ goalId: goal.id, pace: "sampled" })).resolves.toStrictEqual({
      status: "unchanged",
    });

    await expect(
      prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId: plan.id } }),
    ).resolves.toStrictEqual(saved);

    // The Plan offers them, and Apply adds what the offer said.
    const after = await readPlanScreen();
    expect(after?.fitOffer?.effect.lessonsAdded).toBeGreaterThan(0);

    await expect(
      changeGoalPlan({ goalId: goal.id, input: { operations: [{ kind: "fitLessons" }] } }),
    ).resolves.toMatchObject({
      change: { effect: { lessonsAdded: after?.fitOffer?.effect.lessonsAdded } },
      status: "applied",
    });

    // With lessons to do again, the next session's refresh doesn't take his faster pace, so it adds
    // nothing by itself: the plan keeps the lessons Apply brought in.
    const applied = await countLessonsLeft(plan.id);
    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });
    await expect(countLessonsLeft(plan.id)).resolves.toBe(applied);
  });

  // The first case's plan at the pace it was made at: a session's refresh no longer saves his
  // faster pace. The offer and the Plan read after Apply measure the same plan, so they say the
  // same: the four lessons the Library wrote for each topic don't all fit by his date at 15
  // minutes a day, so neither says his time covers everything.
  it("says after Apply what the offer said at the plan's own pace", async () => {
    const { goal } = await aheadPlanFixture({ dailyMinutes: 15 });
    const before = await readPlanScreen();

    expect(before?.fitOffer).toMatchObject({ operations: [{ kind: "fitLessons" }] });

    await expect(
      changeGoalPlan({ goalId: goal.id, input: { operations: [{ kind: "fitLessons" }] } }),
    ).resolves.toMatchObject({ status: "applied" });

    const after = await readPlanScreen();

    expect({ offer: before?.fitOffer?.fits, read: after?.feasibility?.fits }).toStrictEqual({
      offer: false,
      read: false,
    });
  });
});

/*
 * A plan handed over with only what placement settled holds no lesson to do yet, and every lesson
 * it holds is behind the learner: its first read still lays it out. Read as a finished plan, it
 * stayed "being built" with no phases.
 */
describe("a plan never laid out", () => {
  it("is laid out on its first read, whatever placement settled", async () => {
    const user = await userFixture();
    const { goal } = await goalWithBasesFixture({ days: 30, kind: "exam", userId: user.id });
    mockSession(user.id);

    await refreshGoalPlan({ goalId: goal.id, settleOnly: true });

    await expect(readPlanScreen()).resolves.toMatchObject({ ready: true });
  });
});
