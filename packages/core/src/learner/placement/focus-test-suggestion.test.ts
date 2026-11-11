import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { afterEach, describe, expect, it, vi } from "vitest";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import * as proposals from "../../plans/propose-plan-change";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import { PLAN_SHOWN, shortPlanExamGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { settleFocusTestAfterSession } from "./_utils/settle-focus-test";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { NEW_FOCUS_TEST_RECORD, readFocusTestRecord } from "./focus-test-state";
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

  it("allows an empty plan focus despite stored ownership left by an earlier writer", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ goal: SHOWN });
    const current = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    const details = isJsonObject(current.details) ? current.details : {};
    const record = readFocusTestRecord(current) ?? NEW_FOCUS_TEST_RECORD;

    await prisma.goal.update({
      data: { details: { ...details, focusTest: { ...record, focus: ["Ética"] } } },
      where: { id: goal.id },
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      settings: { focusAreas: [] },
    });

    await expect(
      proposals.proposePlanChange({
        approval: "always",
        goalId: goal.id,
        operations: [{ areas: ["Direito", "Português"], kind: "focusAreas" }],
        reason: "",
        source: "focusTest",
      }),
    ).resolves.toMatchObject({ status: "proposed" });

    const admitted = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    expect(readFocusTestRecord(admitted)?.focus).toStrictEqual(["Ética"]);
  });

  it("proposes with no focus after the test's earlier applied focus was replaced and removed", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ goal: SHOWN });
    const focus = await sit(goal.id, 1);

    await expect(
      decidePlanChange({
        changeId: focus!.proposal!.id,
        goalId: goal.id,
        input: { status: "applied" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(chooseFocus(goal.id, ["Ética"])).resolves.not.toBe("");
    const replaced = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: {
          operations: [
            { areas: [], kind: "focusAreas" },
            { kind: "setDailyMinutes", minutes: goal.dailyMinutes },
          ],
        },
        trackAnalytics: false,
      }),
    ).resolves.toMatchObject({ status: "applied" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      settings: { focusAreas: [] },
    });

    await expect(read(goal.id)).resolves.toStrictEqual({
      changes: ["applied"],
      focus: "suggested",
    });

    await expect(sit(goal.id, 0)).resolves.toMatchObject({ state: "proposed" });

    await expect(read(goal.id)).resolves.toStrictEqual({
      changes: ["applied", "proposed"],
      focus: "proposed",
    });

    expect(readFocusTestRecord(replaced)?.focus).toBeNull();
  });

  it("restores test ownership when the learner undoes their own replacement", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ goal: SHOWN });
    const focus = await sit(goal.id, 1);

    await expect(
      decidePlanChange({
        changeId: focus!.proposal!.id,
        goalId: goal.id,
        input: { status: "applied" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    const own = await chooseFocus(goal.id, ["Ética"]);

    await expect(
      decidePlanChange({ changeId: own, goalId: goal.id, input: { status: "undone" } }),
    ).resolves.toMatchObject({ status: "updated" });

    const restored = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    const areas = focus!.rows.flatMap((row) => row.areas);
    expect(readFocusTestRecord(restored)?.focus).toStrictEqual(areas);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      settings: { focusAreas: areas },
    });

    await expect(read(goal.id)).resolves.toStrictEqual({ changes: ["applied"], focus: "current" });

    await expect(
      proposals.proposePlanChange({
        approval: "always",
        goalId: goal.id,
        operations: [{ areas: ["Informática", "Raciocínio"], kind: "focusAreas" }],
        reason: "",
        source: "focusTest",
      }),
    ).resolves.toMatchObject({ status: "proposed" });
  });

  it("restores learner ownership when Undo of a test proposal brings back a hand-picked focus", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ goal: SHOWN });
    await expect(chooseFocus(goal.id, ["Ética"])).resolves.not.toBe("");
    await expect(sit(goal.id, 1)).resolves.toMatchObject({ state: "handPicked" });

    const removed = await changeGoalPlan({
      goalId: goal.id,
      input: {
        operations: [
          { areas: [], kind: "focusAreas" },
          { kind: "setDailyMinutes", minutes: goal.dailyMinutes },
        ],
      },
      trackAnalytics: false,
    });

    if (removed?.status !== "applied" || !removed.change) {
      throw new Error(`Expected an applied change, received ${removed?.status}`);
    }

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      settings: { focusAreas: [] },
    });

    const focus = await sit(goal.id, 0);
    expect(focus).toMatchObject({ state: "proposed" });

    await expect(
      decidePlanChange({
        changeId: removed.change.id,
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(read(goal.id)).resolves.toStrictEqual({
      changes: ["proposed"],
      focus: "proposed",
    });

    await expect(
      decidePlanChange({
        changeId: focus!.proposal!.id,
        goalId: goal.id,
        input: { status: "applied" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(
      decidePlanChange({
        changeId: focus!.proposal!.id,
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    const restored = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(readFocusTestRecord(restored)?.focus).toBeNull();

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      settings: { focusAreas: ["Ética"] },
    });

    await expect(read(goal.id)).resolves.toStrictEqual({
      changes: ["undone"],
      focus: "handPicked",
    });

    await expect(
      proposals.proposePlanChange({
        approval: "always",
        goalId: goal.id,
        operations: [{ areas: ["Informática", "Raciocínio"], kind: "focusAreas" }],
        reason: "",
        source: "focusTest",
      }),
    ).resolves.toMatchObject({ status: "notDue" });
  });

  it("keeps test ownership through an unrelated change and Undo", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ goal: SHOWN });
    const focus = await sit(goal.id, 1);

    await decidePlanChange({
      changeId: focus!.proposal!.id,
      goalId: goal.id,
      input: { status: "applied" },
    });

    const edited = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [1] }] },
      trackAnalytics: false,
    });

    if (edited?.status !== "applied" || !edited.change) {
      throw new Error(`Expected an applied change, received ${edited?.status}`);
    }

    await expect(
      decidePlanChange({
        changeId: edited.change.id,
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    const areas = focus!.rows.flatMap((row) => row.areas);
    const restored = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(readFocusTestRecord(restored)?.focus).toStrictEqual(areas);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      settings: { focusAreas: areas },
    });

    await expect(read(goal.id)).resolves.toStrictEqual({ changes: ["applied"], focus: "current" });
  });

  it("restores the earlier test focus and ownership when its next proposal is undone", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ goal: SHOWN });
    const areas = ["Português", "Ética"];

    const earlier = await proposals.proposePlanChange({
      approval: "always",
      goalId: goal.id,
      operations: [{ areas, kind: "focusAreas" }],
      reason: "",
      source: "focusTest",
    });

    expect(earlier).toMatchObject({ status: "proposed" });

    if (earlier?.status !== "proposed") {
      throw new Error(`Expected a proposal, received ${earlier?.status}`);
    }

    await expect(
      decidePlanChange({
        changeId: earlier.changeId,
        goalId: goal.id,
        input: { status: "applied" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    const focus = await sit(goal.id, 1);
    expect(focus).toMatchObject({ state: "proposed" });

    await expect(
      decidePlanChange({
        changeId: focus!.proposal!.id,
        goalId: goal.id,
        input: { status: "applied" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(
      decidePlanChange({
        changeId: focus!.proposal!.id,
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    const restored = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(readFocusTestRecord(restored)?.focus).toStrictEqual(areas);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      settings: { focusAreas: areas },
    });

    await expect(read(goal.id)).resolves.toStrictEqual({
      changes: ["applied", "undone"],
      focus: "declined",
    });
  });

  it.each(["declined", "undone"] as const)(
    "keeps an in-flight completion from proposing a set the learner just %s",
    async (status) => {
      const { goal } = await shortPlanExamGoalFixture({ goal: SHOWN });
      const placement = await startSitting(goal.id);

      await answerPlacementQuestion({
        goalId: goal.id,
        input: { answer: { dontKnow: true }, durationMs: 20_000, itemId: placement.next!.itemId },
      });

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

        const changeId = fast.completion.focusTest!.checkpoint!.focus!.proposal!.id;

        if (status === "undone") {
          const applied = await decidePlanChange({
            changeId,
            goalId: goal.id,
            input: { status: "applied" },
          });

          if (applied.status !== "updated") {
            throw new Error(applied.status);
          }
        }

        await expect(
          decidePlanChange({ changeId, goalId: goal.id, input: { status } }),
        ).resolves.toMatchObject({ status: "updated" });
      } finally {
        resume.resolve(null);
        await slow.finally(() => spy.mockRestore());
      }

      await expect(read(goal.id)).resolves.toStrictEqual({ changes: [status], focus: "declined" });

      await expect(slow).resolves.toMatchObject({
        completion: { focusTest: { checkpoint: { focus: { proposal: null, state: "declined" } } } },
        status: "ready",
      });
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
