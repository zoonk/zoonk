import { prisma } from "@zoonk/db";
import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession, mockSession } from "../_test-utils/mock-session";
import { getAllowance } from "../entitlements/get-allowance";
import { getLearnerSummary } from "../learner/summary/get-learner-summary";
import { getGoalPlan } from "../plans/get-goal-plan";
import { getGoalPreparation } from "../preparation/get-goal-preparation";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import {
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { startStudyBlock } from "../sessions/start-study-block";
import { getChallenge } from "./get-challenge";
import { startChallenge } from "./start-challenge";

async function reachedLanguageChallenge({ dailyMinutes = 45, final = false, plus = false } = {}) {
  const user = await userFixture();

  const setup = await sessionGoalFixture({
    goal: { dailyMinutes, kind: "language", targetLanguage: "en" },
    lessons: 3,
    userId: user.id,
  });

  const later = setup.planItems.at(-1)!;
  await prisma.planItem.updateMany({ data: { status: "done" }, where: { planId: setup.plan.id } });

  if (!final) {
    await prisma.planItem.update({
      data: { phase: 1, position: 5, status: "todo" },
      where: { id: later.id },
    });
  }

  const boss = await checkpointItemFixture({
    kind: "boss",
    phase: final ? 1 : 0,
    planId: setup.plan.id,
    position: final ? 5 : 2,
    scheduledFor: SESSION_TODAY,
  });

  if (plus) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  await layOutPlanFixture(setup.plan.id);
  mockSession(user.id);
  return { ...setup, boss, user };
}

async function challengeOf(planItemId: string) {
  const result = await getChallenge({ input: {}, planItemId });

  if (result.status !== "ready") {
    throw new Error(`Expected challenge, got ${result.status}`);
  }

  return result.challenge;
}

describe("language challenges are Plus only", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([false, true])(
    "locks the same call for Free and leaves lessons reachable (final: %s)",
    async (final) => {
      const { boss, goal, user } = await reachedLanguageChallenge({ final });

      await expect(challengeOf(boss.id)).resolves.toMatchObject({
        call: { targetLanguage: "en" },
        kind: final ? "finalBoss" : "boss",
        locked: true,
        questions: 0,
        status: "plusRequired",
      });

      await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toStrictEqual({
        status: "plusRequired",
      });

      const today = await getTodayStudySession({ goalId: goal.id });

      if (today.status !== "ready") {
        throw new Error(`Expected session, got ${today.status}`);
      }

      expect(today.session.blocks.some((block) => block.kind === "checkpoint")).toBe(false);

      const view = await getGoalPlan(goal.id);

      expect(view.status === "ready" && view.plan.end).toStrictEqual(
        final ? { kind: "finished" } : null,
      );

      expect(view.status === "ready" && view.plan.currentPhase).toBe(1);

      await expect(
        prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
      ).resolves.toMatchObject({ status: "todo" });

      await expect(getAllowance()).resolves.toMatchObject({
        callTime: { usedSeconds: 0, usedSecondsThisMonth: 0 },
      });

      await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(
        0,
      );
    },
  );

  it("lets Free start the next phase's lesson without the locked call", async () => {
    const { goal } = await reachedLanguageChallenge();
    const today = await getTodayStudySession({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error(`Expected session, got ${today.status}`);
    }

    const next = today.session.blocks.find((block) => block.kind === "learn");
    expect(next).toBeDefined();

    await expect(
      startStudyBlock({ blockId: next!.id, input: {}, sessionId: today.session.id }),
    ).resolves.toMatchObject({ status: "ready" });
  });

  it("reads Free's plan, phases and pace finished while the locked call stays todo", async () => {
    const { goal } = await reachedLanguageChallenge({ final: true });
    const view = await getGoalPlan(goal.id);

    expect(
      view.status === "ready" && view.plan.phases.every((phase) => phase.state === "done"),
    ).toBe(true);

    await expect(getGoalPreparation(goal.id)).resolves.toMatchObject({
      preparation: { status: { kind: "finished" } },
    });
  });

  it("leaves the call open and required for Plus", async () => {
    const { boss, goal } = await reachedLanguageChallenge({ final: true, plus: true });

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      call: { targetLanguage: "en" },
      locked: false,
      questions: 0,
    });

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toMatchObject({
      status: "ready",
    });

    const view = await getGoalPlan(goal.id);
    expect(view.status === "ready" && view.plan.end).toBeNull();
  });

  it.each([false, true])(
    "locks a scheduled call after Plus lapses (started: %s)",
    async (started) => {
      const { boss, goal, user } = await reachedLanguageChallenge({ dailyMinutes: 6, plus: true });
      const intro = await challengeOf(boss.id);
      expect(intro.blockId).toBeNull();
      await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);

      const opened = started
        ? await startChallenge({ input: {}, planItemId: boss.id })
        : await getTodayStudySession({ goalId: goal.id });

      expect(opened.status).toBe("ready");

      const scheduled = await challengeOf(boss.id);
      expect(scheduled.blockId).not.toBeNull();

      await prisma.subscription.updateMany({
        data: { status: "canceled" },
        where: { referenceId: user.id },
      });

      await expect(challengeOf(boss.id)).resolves.toMatchObject({
        blockId: scheduled.blockId,
        call: { targetLanguage: "en" },
        locked: true,
        questions: 0,
        status: "plusRequired",
      });

      await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toStrictEqual({
        status: "plusRequired",
      });

      const savedBlock = await prisma.studySessionBlock.findUniqueOrThrow({
        where: { id: scheduled.blockId! },
      });

      await expect(
        startStudyBlock({ blockId: savedBlock.id, input: {}, sessionId: savedBlock.sessionId }),
      ).resolves.toStrictEqual({ status: "plusRequired" });

      await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
      const after = await getTodayStudySession({ goalId: goal.id });

      expect(
        after.status === "ready" &&
          after.session.blocks.some((block) => block.id === scheduled.blockId),
      ).toBe(false);

      mockAccountSession({ user });

      await expect(getLearnerSummary()).resolves.toMatchObject({
        today: { next: expect.objectContaining({ sessionId: expect.any(String) }) },
      });

      await expect(getAllowance()).resolves.toMatchObject({ callTime: { usedSeconds: 0 } });
    },
  );
});
