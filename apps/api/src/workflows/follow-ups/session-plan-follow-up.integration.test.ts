import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { getWorld } from "workflow/runtime";
import {
  PLAN_SHOWN,
  shortPlanExamGoalFixture,
} from "../../../../../packages/core/src/learner/_test-utils/exam-test-goal";
import { readFocusTestRecord } from "../../../../../packages/core/src/learner/placement/focus-test-state";
import * as proposals from "../../../../../packages/core/src/plans/propose-plan-change";
import * as rebalance from "../../../../../packages/core/src/preparation/rebalance-plan";
import { settleSessionDay } from "../../../../../packages/core/src/sessions/_utils/settle-session-day";
import { startOnce } from "../_shared/run-token";
import { followUpsWorkflow, getFollowUpsToken } from "./follow-ups-workflow";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));
vi.mock("@zoonk/core/analytics/request-platform", () => ({ getRequestPlatform: async () => null }));

async function endedSession() {
  const { goal, plan, user } = await shortPlanExamGoalFixture({
    goal: { ...PLAN_SHOWN, timezone: "UTC" },
  });

  const [item, session] = await Promise.all([
    prisma.item.findFirstOrThrow({ where: { examBlueprintId: goal.examBlueprintId } }),
    studySessionFixture({ goalId: goal.id, plannedMinutes: 0, userId: user.id }),
  ]);

  await attemptFixture({
    answer: { dontKnow: true },
    isCorrect: false,
    isPlacement: true,
    itemId: item.id,
    skillId: item.skillId,
    studySessionId: session.id,
    userId: user.id,
  });

  await settleSessionDay({ sessionId: session.id, timeZone: "UTC", userId: user.id });

  const owed = await prisma.followUp.findFirstOrThrow({
    where: { key: session.id, kind: "settleSessionPlan", userId: user.id },
  });
  // Preparation and memory have their own coverage; dispatch only this session's plan work.
  await prisma.followUp.deleteMany({ where: { id: { not: owed.id }, userId: user.id } });
  return { goal, owed, plan, session, user };
}

async function dispatch(userId: string) {
  const runId = await startOnce(followUpsWorkflow, [{ userId }], getFollowUpsToken(userId));
  return getRun(runId);
}

describe("a session's owed plan settlement", () => {
  afterEach(() => vi.restoreAllMocks());

  it("retries a failed proposal write in its step, settles the summary and proposes before rebalancing", async () => {
    const { goal, owed, plan, user } = await endedSession();

    const readSummary = async () =>
      readFocusTestRecord(await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }))?.summary;

    await expect(readSummary()).resolves.toMatchObject({ asked: 0 });
    const rebalancePlan = vi.spyOn(rebalance, "rebalancePlanAfterSession");
    // A transient proposal-write failure cannot be produced safely with ordinary database fixtures.
    const propose = vi.spyOn(proposals, "proposePlanChange").mockImplementationOnce(async () => {
      await expect(readSummary()).resolves.toMatchObject({ asked: 1 });
      await expect(prisma.followUp.findUnique({ where: { id: owed.id } })).resolves.not.toBeNull();
      expect(rebalancePlan).not.toHaveBeenCalled();
      throw new Error("Transient proposal-write failure");
    });

    const run = await dispatch(user.id);
    await expect(run.returnValue).resolves.toBeUndefined();
    expect(propose).toHaveBeenCalledTimes(2);
    expect(rebalancePlan).toHaveBeenCalledOnce();
    const world = await getWorld();
    const steps = await world.steps.list({ runId: run.runId });

    expect(
      steps.data.find((step) => step.stepName.endsWith("//settleSessionPlanStep")),
    ).toMatchObject({ attempt: 2 });

    await expect(readSummary()).resolves.toMatchObject({ asked: 1 });

    await expect(
      prisma.planChange.findMany({
        where: { payload: { equals: "focusTest", path: ["source"] }, planId: plan.id },
      }),
    ).resolves.toMatchObject([{ payload: { source: "focusTest" }, status: "proposed" }]);

    await expect(prisma.followUp.findUnique({ where: { id: owed.id } })).resolves.toBeNull();
  });

  it("keeps the obligation when the step exhausts its retries", async () => {
    const { owed, user } = await endedSession();
    // Fault injection at the proposal boundary leaves every real summary and follow-up write intact.
    const propose = vi
      .spyOn(proposals, "proposePlanChange")
      .mockRejectedValue(new Error("Database unavailable"));

    const run = await dispatch(user.id);
    await expect(run.returnValue).rejects.toThrow("Database unavailable");
    expect(propose).toHaveBeenCalledTimes(4);

    await expect(prisma.followUp.findUnique({ where: { id: owed.id } })).resolves.toMatchObject(
      owed,
    );

    propose.mockRestore();
    const recovered = await dispatch(user.id);
    await expect(recovered.returnValue).resolves.toBeUndefined();
    await expect(prisma.followUp.findUnique({ where: { id: owed.id } })).resolves.toBeNull();
  });
});
