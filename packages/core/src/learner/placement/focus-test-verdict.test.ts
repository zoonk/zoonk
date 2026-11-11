import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, describe, expect, it, vi } from "vitest";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import { PLAN_SHOWN, shortPlanExamGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { readFocusTestRecord } from "./focus-test-state";
import { getGoalPlacement } from "./get-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

const TIME_ZONE = "UTC";

async function sit(goalId: string, answers: number) {
  let placement = await startSitting(goalId);

  for (let index = 0; index < answers && placement.next; index += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Each answer decides the next question.
    const result = await answerPlacementQuestion({
      goalId,
      input: { answer: { dontKnow: true }, durationMs: 20_000, itemId: placement.next.itemId },
    });

    if (result.status !== "ready") {
      throw new Error(result.status);
    }

    placement = result.placement;
  }

  const result = await finishGoalPlacement({ goalId, input: {} });
  return result.status === "ready" ? result.completion.focusTest : null;
}

async function read(goalId: string) {
  const [view, goal, plan, changes] = await Promise.all([
    getGoalPlacement({ goalId }),
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    prisma.plan.findUniqueOrThrow({ where: { goalId } }),
    prisma.planChange.findMany({
      select: { status: true },
      where: { payload: { equals: "focusTest", path: ["source"] }, plan: { goalId } },
    }),
  ]);

  const test = view.status === "ready" ? view.placement.focusTest : null;

  return {
    covered: plan.coveredShare,
    focus: test?.checkpoint ? (test.checkpoint.focus?.state ?? null) : "no checkpoint",
    focusTestChanges: changes.map((change) => change.status),
    handled: readFocusTestRecord(goal)?.handled,
    offer: test?.offer?.kind ?? null,
    planVersion: plan.version,
    sessionQuestions: test?.sessionQuestions,
  };
}

function mockNow() {
  const now = new Date();

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    currentInstant: now,
    timeZone: TIME_ZONE,
  });
}

describe("Focus test verdicts between settle points", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    { lessons: 1, outcome: "alreadyIn", state: "alreadyFits" },
    { lessons: 8, outcome: "cantMove", state: null },
  ] as const)(
    "keeps $outcome after a daily replan and settlement",
    async ({ lessons, outcome, state }) => {
      const { goal } = await shortPlanExamGoalFixture({
        daysLeft: 10,
        goal: { ...PLAN_SHOWN, timezone: TIME_ZONE },
        lessons,
      });

      const finished = await sit(goal.id, 1);
      const afterFinish = await read(goal.id);

      mockNow();
      const today = await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });
      const afterToday = await read(goal.id);

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.now() + MS_PER_DAY);
      mockNow();
      const tomorrow = await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });
      const afterTomorrow = await read(goal.id);
      vi.useRealTimers();

      expect(finished?.checkpoint?.focus?.state ?? null).toBe(state);
      expect(afterFinish.handled?.outcome).toBe(outcome);
      expect([today.status, tomorrow.status]).toStrictEqual(["ready", "ready"]);
      expect(afterToday.focus).toBe(afterFinish.focus);
      expect(afterTomorrow.planVersion).toBeGreaterThan(afterFinish.planVersion);
      expect(afterTomorrow.handled).toStrictEqual(afterFinish.handled);
      expect(afterTomorrow.focus).toBe(state);

      await finishGoalPlacement({ goalId: goal.id, input: {} });
      const afterSettle = await read(goal.id);
      expect(afterSettle.handled).toStrictEqual(afterFinish.handled);
    },
  );

  it.each([
    { days: 2, priorDismissal: true },
    { days: 3, priorDismissal: false },
    { days: 5, priorDismissal: false },
  ])(
    "hides alreadyFits after a date edit to $days days (prior dismissal: $priorDismissal)",
    async ({ days, priorDismissal }) => {
      const { goal, plan } = await shortPlanExamGoalFixture({
        daysLeft: 10,
        goal: { ...PLAN_SHOWN, timezone: TIME_ZONE },
        lessons: 1,
      });

      if (priorDismissal) {
        await planChangeFixture({
          payload: { operations: [{ areas: ["Ética"], kind: "focusAreas" }], source: "focusTest" },
          planId: plan.id,
          status: "declined",
        });
      }

      const finished = await sit(goal.id, 1);
      expect(finished?.checkpoint?.focus?.state).toBe("alreadyFits");
      const before = await read(goal.id);

      const targetDate = new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);

      await expect(
        changeGoalPlan({
          goalId: goal.id,
          input: { operations: [{ kind: "setTargetDate", targetDate }] },
          trackAnalytics: false,
        }),
      ).resolves.toMatchObject({ status: "applied" });

      const changed = await read(goal.id);
      expect(changed.focus).toBeNull();
      expect(changed.handled).toStrictEqual(before.handled);
      expect(changed.focusTestChanges).toStrictEqual(priorDismissal ? ["declined"] : []);

      await expect(finishGoalPlacement({ goalId: goal.id, input: {} })).resolves.toMatchObject({
        completion: { focusTest: { checkpoint: { focus: { state: "proposed" } } } },
      });

      const settled = await read(goal.id);
      expect(settled.handled).toMatchObject({ dailyMinutes: goal.dailyMinutes, targetDate });
    },
  );

  it("recomputes cantMove after changing the daily time", async () => {
    const { goal } = await shortPlanExamGoalFixture({
      daysLeft: 10,
      goal: { ...PLAN_SHOWN, timezone: TIME_ZONE },
    });

    await sit(goal.id, 1);
    const before = await read(goal.id);
    expect(before.handled?.outcome).toBe("cantMove");

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 15 }] },
        trackAnalytics: false,
      }),
    ).resolves.toMatchObject({ status: "applied" });

    const changed = await read(goal.id);
    expect(changed.focus).toBeNull();
    expect(changed.handled).toStrictEqual(before.handled);
    expect(changed.focusTestChanges).toStrictEqual([]);

    await finishGoalPlacement({ goalId: goal.id, input: {} });
    const settled = await read(goal.id);
    expect(settled.handled).toMatchObject({ dailyMinutes: 15 });
  });

  it("a finished test whose suggestion couldn't move the plan, after the date moves", async () => {
    const { goal } = await shortPlanExamGoalFixture({ daysLeft: 10, goal: PLAN_SHOWN });
    const finished = await sit(goal.id, 15);
    const afterFinish = await read(goal.id);

    const moved = await changeGoalPlan({
      goalId: goal.id,
      input: {
        operations: [
          {
            kind: "setTargetDate",
            targetDate: new Date(Date.now() + 30 * MS_PER_DAY).toISOString().slice(0, 10),
          },
        ],
      },
      trackAnalytics: false,
    });

    const afterMove = await read(goal.id);

    const started = await startPlacementSitting({ goalId: goal.id, input: {} });
    const afterStart = await read(goal.id);

    const again = await finishGoalPlacement({ goalId: goal.id, input: {} });

    expect(finished?.checkpoint?.focus).toBeNull();
    expect(afterFinish.handled?.outcome).toBe("cantMove");
    expect(moved.status).toBe("applied");
    expect(afterMove.planVersion).toBeGreaterThan(afterFinish.planVersion);
    expect(afterMove.handled).toStrictEqual(afterFinish.handled);
    expect(afterMove.focus).toBeNull();
    expect(started.status === "ready" && started.placement.focusTest?.sitting).toBeNull();

    expect(again).toMatchObject({
      completion: { focusTest: { checkpoint: { focus: { state: "proposed" } } } },
    });

    expect(afterStart.focus).toBeNull();
  });
});
