import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { isJsonObject } from "@zoonk/utils/json";
import { describe, expect, it, vi } from "vitest";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import * as proposals from "../../plans/propose-plan-change";
import { PLAN_SHOWN, shortPlanExamGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { readFocusTestRecord } from "./focus-test-state";
import { getGoalPlacement } from "./get-goal-placement";

async function overlappingFocus() {
  const fixture = await shortPlanExamGoalFixture({ goal: { ...PLAN_SHOWN, timezone: "UTC" } });
  const { goal } = fixture;
  const areas = ["Português", "Ética"];

  await expect(
    changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ areas, kind: "focusAreas" }] },
      trackAnalytics: false,
    }),
  ).resolves.toMatchObject({ status: "applied" });

  const current = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
  const details = isJsonObject(current.details) ? current.details : {};
  const record = readFocusTestRecord(current);

  if (!record) {
    throw new Error("The fixture did not initialize the test record");
  }

  await prisma.goal.update({
    data: { details: { ...details, focusTest: { ...record, focus: areas } } },
    where: { id: goal.id },
  });

  return fixture;
}

async function answerOne(goalId: string) {
  const placement = await startSitting(goalId);

  await expect(
    answerPlacementQuestion({
      goalId,
      input: { answer: { dontKnow: true }, durationMs: 20_000, itemId: placement.next!.itemId },
    }),
  ).resolves.toMatchObject({
    placement: {
      focusTest: {
        checkpoint: { focus: { rows: [{ areas: ["Direito"] }, { areas: ["Português"] }] } },
      },
    },
    status: "ready",
  });
}

async function changes(goalId: string) {
  const rows = await prisma.planChange.findMany({
    orderBy: { createdAt: "asc" },
    where: { payload: { equals: "focusTest", path: ["source"] }, plan: { goalId } },
  });

  return rows.map((row) => row.status);
}

describe("proposal admission for the full suggested focus", () => {
  it.each(["declined", "proposed"] as const)(
    "does not repeat an overlapping focus while the faster completion's proposal is %s",
    async (status) => {
      const { goal } = await overlappingFocus();
      await answerOne(goal.id);
      const paused = Promise.withResolvers<null>();
      const resume = Promise.withResolvers<null>();
      const original = proposals.proposePlanChange;

      const spy = vi.spyOn(proposals, "proposePlanChange").mockImplementationOnce(async (input) => {
        paused.resolve(null);
        await resume.promise;
        return original(input);
      });

      const slow = finishGoalPlacement({ goalId: goal.id, input: {} });

      try {
        await paused.promise;
        const fast = await finishGoalPlacement({ goalId: goal.id, input: {} });

        if (fast.status !== "ready") {
          throw new Error(fast.status);
        }

        if (status === "declined") {
          const decision = await decidePlanChange({
            changeId: fast.completion.focusTest!.checkpoint!.focus!.proposal!.id,
            goalId: goal.id,
            input: { status },
          });

          if (decision.status !== "updated") {
            throw new Error(decision.status);
          }
        }
      } finally {
        resume.resolve(null);
        await slow.finally(() => spy.mockRestore());
      }

      await expect(changes(goal.id)).resolves.toStrictEqual([status]);

      await expect(slow).resolves.toMatchObject({
        completion: { focusTest: { checkpoint: { focus: { state: status } } } },
        status: "ready",
      });
    },
  );

  it("does not treat a declined subset as a dismissal of the bigger suggested set", async () => {
    const { goal, plan } = await overlappingFocus();

    await planChangeFixture({
      payload: { operations: [{ areas: ["Direito"], kind: "focusAreas" }], source: "focusTest" },
      planId: plan.id,
      status: "declined",
    });

    await answerOne(goal.id);

    await expect(finishGoalPlacement({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      completion: { focusTest: { checkpoint: { focus: { state: "proposed" } } } },
      status: "ready",
    });

    await expect(changes(goal.id)).resolves.toStrictEqual(["declined", "proposed"]);

    await expect(getGoalPlacement({ goalId: goal.id })).resolves.toMatchObject({
      placement: { focusTest: { checkpoint: { focus: { state: "proposed" } } } },
      status: "ready",
    });
  });
});
