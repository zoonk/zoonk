import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, describe, expect, it, vi } from "vitest";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import { PLAN_SHOWN, shortPlanExamGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { settleFocusTestAfterSession } from "./_utils/settle-focus-test";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";

const TIME_ZONE = "UTC";
const SHOWN = { ...PLAN_SHOWN, timezone: TIME_ZONE };

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

  return result.status === "ready"
    ? (result.completion.focusTest?.checkpoint?.focus ?? null)
    : null;
}

async function read(goalId: string) {
  const [view, changes] = await Promise.all([
    getGoalPlacement({ goalId }),
    prisma.planChange.findMany({
      orderBy: { createdAt: "asc" },
      select: { status: true },
      where: { payload: { equals: "focusTest", path: ["source"] }, plan: { goalId } },
    }),
  ]);

  const focus = view.status === "ready" ? view.placement.focusTest?.checkpoint?.focus : null;
  return { changes: changes.map((change) => change.status), focus: focus?.state ?? null };
}

async function chooseFocus(goalId: string, areas: string[]) {
  const result = await changeGoalPlan({
    goalId,
    input: { operations: [{ areas, kind: "focusAreas" }] },
    trackAnalytics: false,
  });

  return result?.status === "applied" ? (result.change?.id ?? "") : "";
}

describe("the checkpoint's focus, read from the plan and the test's proposals", () => {
  afterEach(() => vi.useRealTimers());

  it("makes no claim while the plan has time for the suggestion, and proposes once missed days take it", async () => {
    const { goal } = await shortPlanExamGoalFixture({ daysLeft: 10, goal: SHOWN, lessons: 1 });

    await expect(sit(goal.id, 1)).resolves.toMatchObject({ proposal: null, state: "suggested" });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 3 * MS_PER_DAY);
    const now = new Date();

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      currentInstant: now,
      timeZone: TIME_ZONE,
    });

    await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });
    await expect(read(goal.id)).resolves.toStrictEqual({ changes: [], focus: "suggested" });

    await expect(sit(goal.id, 1)).resolves.toMatchObject({
      proposal: { source: "focusTest", status: "proposed" },
      state: "proposed",
    });
  });

  it("makes no claim once rest days leave the suggestion unable to move the plan", async () => {
    const { goal } = await shortPlanExamGoalFixture({ daysLeft: 10, goal: SHOWN, lessons: 1 });
    await sit(goal.id, 1);

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: {
          operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [1, 2, 3, 4, 5] }],
        },
        trackAnalytics: false,
      }),
    ).resolves.toMatchObject({ status: "applied" });

    await expect(read(goal.id)).resolves.toStrictEqual({ changes: [], focus: "suggested" });
    await expect(sit(goal.id, 0)).resolves.toMatchObject({ proposal: null, state: "suggested" });
    await expect(read(goal.id)).resolves.toStrictEqual({ changes: [], focus: "suggested" });
  });

  it.each(["removed", "undone"] as const)(
    "proposes again once the learner's own focus that replaced its proposal is %s",
    async (how) => {
      const { goal } = await shortPlanExamGoalFixture({ goal: SHOWN });
      await expect(sit(goal.id, 1)).resolves.toMatchObject({ state: "proposed" });

      const own = await chooseFocus(goal.id, ["Ética"]);

      await expect(read(goal.id)).resolves.toStrictEqual({
        changes: ["replaced"],
        focus: "handPicked",
      });

      if (how === "removed") {
        await chooseFocus(goal.id, []);
      } else {
        await decidePlanChange({ changeId: own, goalId: goal.id, input: { status: "undone" } });
      }

      await expect(read(goal.id)).resolves.toStrictEqual({
        changes: ["replaced"],
        focus: "suggested",
      });

      await expect(sit(goal.id, 0)).resolves.toMatchObject({ state: "proposed" });
      await expect(read(goal.id)).resolves.toMatchObject({ changes: ["replaced", "proposed"] });
    },
  );

  it("keeps a dismissed suggestion dismissed after the test proposed other subjects", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ goal: SHOWN });
    const dismissedAt = new Date(Date.now() - MS_PER_DAY);

    await planChangeFixture({
      createdAt: dismissedAt,
      payload: {
        operations: [{ areas: ["Direito", "Português"], kind: "focusAreas" }],
        source: "focusTest",
      },
      planId: plan.id,
      status: "declined",
    });

    await planChangeFixture({
      createdAt: new Date(dismissedAt.getTime() + 1),
      payload: { operations: [{ areas: ["Ética"], kind: "focusAreas" }], source: "focusTest" },
      planId: plan.id,
      status: "undone",
    });

    await expect(sit(goal.id, 1)).resolves.toMatchObject({
      proposal: null,
      rows: [{ areas: ["Direito"] }, { areas: ["Português"] }],
      state: "declined",
    });

    await expect(read(goal.id)).resolves.toStrictEqual({
      changes: ["declined", "undone"],
      focus: "declined",
    });
  });

  it("proposes when a session that asked test questions ends, never while it asks", async () => {
    const { goal, user } = await shortPlanExamGoalFixture({ goal: SHOWN });

    const [item, session] = await Promise.all([
      prisma.item.findFirstOrThrow({ where: { examBlueprintId: goal.examBlueprintId } }),
      studySessionFixture({ goalId: goal.id, localDate: new Date(), userId: user.id }),
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

    await expect(read(goal.id)).resolves.toStrictEqual({ changes: [], focus: "suggested" });
    await settleFocusTestAfterSession({ goalId: goal.id, sessionId: session.id, userId: user.id });

    await expect(read(goal.id)).resolves.toStrictEqual({
      changes: ["proposed"],
      focus: "proposed",
    });
  });
});
