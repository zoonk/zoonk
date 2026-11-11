import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { endFollowUp, listFollowUps } from "../follow-ups/follow-up-rows";
import { PLAN_SHOWN, shortPlanExamGoalFixture } from "../learner/_test-utils/exam-test-goal";
import { readCurrentTestSummary } from "../learner/facts/focus-test-summary";
import { unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import * as rebalance from "../preparation/rebalance-plan";
import { settleSessionDay } from "./_utils/settle-session-day";
import { answerStudyQuestion } from "./answer-study-question";
import { finishStudyBlock } from "./finish-study-block";
import { settleSessionPlan } from "./settle-session-plan";
import { startStudyBlock } from "./start-study-block";
import { stopStudySession } from "./stop-study-session";

describe("the plan work a session end owes", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["complete", false],
    ["stop", false],
    ["complete", true],
    ["stop", true],
  ] as const)(
    "settles resumed test answers at a later %s (first settlement pending: %s)",
    async (ending, pending) => {
      const { goal, plan, user } = await shortPlanExamGoalFixture({
        goal: { ...PLAN_SHOWN, timezone: "UTC" },
      });

      const session = await studySessionFixture({
        goalId: goal.id,
        plannedMinutes: 0,
        userId: user.id,
      });

      const item = await prisma.item.findFirstOrThrow({
        where: { examBlueprintId: goal.examBlueprintId },
      });

      const block = await studySessionBlockFixture({
        kind: "review",
        payload: { itemIds: [item.id], placementItemIds: [item.id] },
        sessionId: session.id,
      });

      const readSummary = () => readCurrentTestSummary(user.id, goal.id);

      const settleOwed = async () => {
        const rows = await listFollowUps(user.id);
        const owed = rows.find((row) => row.kind === "settleSessionPlan");

        if (owed?.kind === "settleSessionPlan") {
          await settleSessionPlan({ ...owed.input, userId: user.id });
          await endFollowUp(owed);
        }
      };

      const rebalancePlan = vi.spyOn(rebalance, "rebalancePlanAfterSession");

      await startStudyBlock({ blockId: block.id, input: {}, sessionId: session.id });
      await stopStudySession({ input: {}, sessionId: session.id });

      const firstOwed = await prisma.followUp.findFirstOrThrow({
        where: { key: session.id, kind: "settleSessionPlan", userId: user.id },
      });

      if (!pending) {
        await settleOwed();
      }

      await expect(readSummary()).resolves.toMatchObject({ asked: 0 });
      expect(rebalancePlan).toHaveBeenCalledTimes(pending ? 0 : 1);

      await startStudyBlock({ blockId: block.id, input: {}, sessionId: session.id });

      await expect(
        answerStudyQuestion({
          blockId: block.id,
          input: { answer: { dontKnow: true }, durationMs: 3000, itemId: item.id },
          sessionId: session.id,
        }),
      ).resolves.toMatchObject({ status: "ready" });

      await expect(readSummary()).resolves.toMatchObject({ asked: 1 });
      await finishStudyBlock({ blockId: block.id, input: {}, sessionId: session.id });

      if (ending === "stop") {
        await studySessionBlockFixture({ kind: "practice", sessionId: session.id });

        await Promise.all([
          stopStudySession({ input: {}, sessionId: session.id }),
          stopStudySession({ input: {}, sessionId: session.id }),
        ]);
      } else {
        await settleSessionDay({ sessionId: session.id, timeZone: "UTC", userId: user.id });
      }

      const owed = await prisma.followUp.findMany({
        where: { kind: "settleSessionPlan", userId: user.id },
      });

      expect(owed).toHaveLength(1);

      expect(owed[0]).toMatchObject({
        input: pending
          ? firstOwed.input
          : { goalId: goal.id, rebalance: false, sessionId: session.id, timeZone: "UTC" },
        key: session.id,
      });

      expect(owed[0]?.revision).toBeGreaterThan(pending ? firstOwed.revision : -1);

      await endFollowUp(firstOwed);

      await expect(
        prisma.followUp.findMany({ where: { kind: "settleSessionPlan", userId: user.id } }),
      ).resolves.toStrictEqual(owed);

      await settleOwed();

      await expect(readSummary()).resolves.toMatchObject({ asked: 1 });

      await expect(
        prisma.planChange.findMany({
          where: { payload: { equals: "focusTest", path: ["source"] }, planId: plan.id },
        }),
      ).resolves.toMatchObject([{ status: "proposed" }]);

      expect(rebalancePlan).toHaveBeenCalledOnce();

      const settledState = () =>
        Promise.all([
          prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
          prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
          prisma.planChange.findMany({ orderBy: { id: "asc" }, where: { planId: plan.id } }),
        ]);

      if (ending === "stop") {
        await stopStudySession({ input: {}, sessionId: session.id });
      } else {
        await settleSessionDay({ sessionId: session.id, timeZone: "UTC", userId: user.id });
      }

      await expect(
        prisma.followUp.findMany({ where: { kind: "settleSessionPlan", userId: user.id } }),
      ).resolves.toMatchObject([
        { input: { rebalance: false, sessionId: session.id }, key: session.id, revision: 0 },
      ]);

      const before = await settledState();
      await settleOwed();
      await expect(settledState()).resolves.toStrictEqual(before);
      expect(rebalancePlan).toHaveBeenCalledOnce();
    },
  );

  it("keeps owing memory when a completed session is reopened and stopped", async () => {
    const user = await userFixture();
    const { goal } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });

    const session = await studySessionFixture({
      goalId: goal.id,
      plannedMinutes: 0,
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      kind: "practice",
      sessionId: session.id,
      status: "completed",
    });

    mockSession(user.id);

    await settleSessionDay({ sessionId: session.id, timeZone: "UTC", userId: user.id });
    const memoryKinds = ["rememberSession", "checkDailyInsight"] as const;

    await prisma.followUp.deleteMany({
      where: { kind: { in: [...memoryKinds] }, userId: user.id },
    });

    await prisma.studySession.update({ data: { status: "active" }, where: { id: session.id } });
    await prisma.studySessionBlock.update({ data: { status: "pending" }, where: { id: block.id } });

    await stopStudySession({ input: {}, sessionId: session.id });

    const owed = await prisma.followUp.findMany({
      orderBy: { kind: "asc" },
      where: { kind: { in: [...memoryKinds] }, userId: user.id },
    });

    expect(owed.map(({ kind }) => kind)).toStrictEqual(memoryKinds);

    await stopStudySession({ input: {}, sessionId: session.id });

    await expect(
      prisma.followUp.findMany({
        orderBy: { kind: "asc" },
        where: { kind: { in: [...memoryKinds] }, userId: user.id },
      }),
    ).resolves.toStrictEqual(owed);
  });

  it.each(["complete", "stop"] as const)(
    "owes it once across concurrent %s requests and later completion",
    async (ending) => {
      const user = await userFixture();
      const { goal } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });

      const session = await studySessionFixture({
        goalId: goal.id,
        plannedMinutes: 0,
        userId: user.id,
      });

      const block = await studySessionBlockFixture({
        kind: "practice",
        sessionId: session.id,
        status: ending === "complete" ? "completed" : "pending",
      });

      mockSession(user.id);

      const complete = () =>
        settleSessionDay({ sessionId: session.id, timeZone: "UTC", userId: user.id });

      const end =
        ending === "complete"
          ? complete
          : () => stopStudySession({ input: {}, sessionId: session.id });

      await Promise.all([end(), end()]);

      const owed = await prisma.followUp.findFirstOrThrow({
        where: { key: session.id, kind: "settleSessionPlan", userId: user.id },
      });

      expect(owed).toMatchObject({
        input: { goalId: goal.id, sessionId: session.id, timeZone: "UTC" },
        revision: 0,
      });

      await end();

      await prisma.studySessionBlock.update({
        data: { status: "completed" },
        where: { id: block.id },
      });

      await complete();

      await expect(
        prisma.followUp.findUniqueOrThrow({ where: { id: owed.id } }),
      ).resolves.toStrictEqual(owed);

      await prisma.followUp.delete({ where: { id: owed.id } });
      await complete();
      await stopStudySession({ input: {}, sessionId: session.id });
      await prisma.studySession.update({ data: { status: "active" }, where: { id: session.id } });

      await prisma.studySessionBlock.update({
        data: { status: "pending" },
        where: { id: block.id },
      });

      await stopStudySession({ input: {}, sessionId: session.id });

      await expect(
        prisma.followUp.count({
          where: { key: session.id, kind: "settleSessionPlan", userId: user.id },
        }),
      ).resolves.toBe(0);
    },
  );
});
