import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { loadGoalPlan } from "./goal-skill-graph";
import { markPlanItemsTestedOut } from "./known-skills";
import { testOutKnownPlanItems } from "./test-out-known-plan-items";
import { writeLearnerChange } from "./write-learner-change";

const NOW = new Date("2020-09-28T12:00:00Z");

async function setup() {
  const [user, stranger, assessed, unassessed, narrow, broad, chapter] = await Promise.all([
    userFixture(),
    userFixture(),
    skillFixture(),
    skillFixture(),
    libraryLessonFixture(),
    libraryLessonFixture(),
    libraryChapterFixture(),
  ]);

  await Promise.all([
    lessonSkillFixture({ lessonId: narrow.id, skillId: assessed.id }),
    lessonSkillFixture({ lessonId: broad.id, skillId: assessed.id }),
    lessonSkillFixture({ lessonId: broad.id, skillId: unassessed.id }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: broad.id }),
  ]);

  const goals = await Promise.all([
    goalFixture({ userId: user.id }),
    goalFixture({ userId: user.id }),
    goalFixture({ status: "paused", userId: user.id }),
    goalFixture({ userId: stranger.id }),
  ]);

  const [source, other, paused, foreign] = await Promise.all(
    goals.map((goal) => planFixture({ goalId: goal.id })),
  );

  if (!source || !other || !paused || !foreign) {
    throw new Error("Missing plans");
  }

  const [sourceItem, shared, pausedItem, broadItem, chapterItem, foreignItem] = await Promise.all([
    planItemFixture({ planId: source.id, skillId: assessed.id }),
    planItemFixture({ lessonId: narrow.id, planId: other.id, position: 0 }),
    planItemFixture({ lessonId: narrow.id, planId: paused.id }),
    planItemFixture({ lessonId: broad.id, planId: other.id, position: 1 }),
    planItemFixture({ chapterId: chapter.id, kind: "chapter", planId: other.id, position: 2 }),
    planItemFixture({ lessonId: narrow.id, planId: foreign.id }),
  ]);

  const day = await studySessionFixture({
    goalId: other.goalId,
    startedAt: NOW,
    status: "active",
    userId: user.id,
  });

  const pending = await studySessionBlockFixture({ lessonId: narrow.id, sessionId: day.id });

  const sourcePlan = await loadGoalPlan(source.goalId);

  const input = {
    followToday: false,
    goalId: source.goalId,
    items: sourcePlan.items,
    knownSkillIds: new Set([assessed.id]),
    testedOutAt: NOW,
    timeZone: "UTC",
  };

  const testOut = () => markPlanItemsTestedOut(input);

  return {
    broadItem,
    chapterItem,
    foreignItem,
    input,
    other,
    paused,
    pausedItem,
    pending,
    shared,
    sourceItem,
    testOut,
    user,
  };
}

describe("test-outs across goals", () => {
  it("shares only the assessed scope with active and paused plans and their saved days", async () => {
    const fixture = await setup();
    await fixture.testOut();

    for (const item of [fixture.sourceItem, fixture.shared, fixture.pausedItem]) {
      // oxlint-disable-next-line no-await-in-loop -- each plan must independently retain completion
      await expect(
        prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
      ).resolves.toMatchObject({ completedAt: NOW, status: "testedOut" });
    }

    for (const item of [fixture.broadItem, fixture.chapterItem, fixture.foreignItem]) {
      // oxlint-disable-next-line no-await-in-loop -- broader and foreign scope must remain open
      await expect(
        prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
      ).resolves.toMatchObject({ completedAt: null, status: "todo" });
    }

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: fixture.pending.id } }),
    ).resolves.toMatchObject({ status: "skipped" });

    const beforeRetry = await prisma.plan.findMany({
      where: { id: { in: [fixture.other.id, fixture.paused.id] } },
    });

    await fixture.testOut();

    await expect(
      prisma.plan.findMany({ where: { id: { in: [fixture.other.id, fixture.paused.id] } } }),
    ).resolves.toStrictEqual(beforeRetry);
  });

  it("commits one shared transition when identical test-outs wait on the learner together", async () => {
    const fixture = await setup();
    const holder = holdLearnerLock({ userId: fixture.user.id });
    const pid = await holder.pid;
    const writes = Promise.all([fixture.testOut(), fixture.testOut()]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      holder.release();
      await Promise.all([holder.done, writes]);
    }

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: fixture.other.id } }),
    ).resolves.toMatchObject({ inputVersion: fixture.other.inputVersion + 1 });

    await expect(
      prisma.followUp.count({ where: { kind: "settleSessionDay", userId: fixture.user.id } }),
    ).resolves.toBe(1);
  });

  it("rolls back the shared item and leaves the saved day intact when its test-out transaction fails", async () => {
    const fixture = await setup();

    await expect(
      writeLearnerChange({ planInputs: true, userId: fixture.user.id }, async (tx) => {
        await testOutKnownPlanItems(tx, fixture.input);
        throw new Error("Abort assessment");
      }),
    ).rejects.toThrow("Abort assessment");

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: fixture.shared.id } }),
    ).resolves.toMatchObject({ status: "todo" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: fixture.pending.id } }),
    ).resolves.toMatchObject({ status: "pending" });

    await expect(
      prisma.followUp.count({ where: { kind: "settleSessionDay", userId: fixture.user.id } }),
    ).resolves.toBe(0);
  });
});
