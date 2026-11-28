import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import * as planContext from "../../plans/_utils/plan-context";
import { loadPlanSnapshot } from "../../plans/_utils/restore-plan";
import { loadTodayPlanChange } from "../../plans/_utils/today-plan-change";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { parsePlanGraph, parsePlanPhases } from "../../plans/planner/plan-state";
import { refreshTestedOutPlan } from "../../plans/refresh-tested-out-plan";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { placementItemBank } from "../_test-utils/placement-tap-items";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

const PHASES = [{ name: "First equations" }, { name: "Checking solutions" }];

async function readPlanView(goalId: string) {
  const result = await getGoalPlan(goalId);

  if (result.status !== "ready") {
    throw new Error("Expected the learner's plan");
  }

  const { currentPhase, phases, status } = result.plan;
  return { currentPhase, phases, status };
}

async function readSchedule(goalId: string) {
  const { graph, items, phases } = await prisma.plan.findUniqueOrThrow({
    include: {
      items: {
        orderBy: { position: "asc" },
        select: { id: true, phase: true, scheduledFor: true, status: true },
      },
    },
    where: { goalId },
  });

  return { graph: parsePlanGraph(graph), items, phases: parsePlanPhases(phases) };
}

async function finishPart({
  goalId,
  length,
  skillIds,
}: {
  goalId: string;
  length: "quick" | "wholeCourse";
  skillIds: string[];
}) {
  const bank = await placementItemBank(skillIds);
  const answers = new Map(bank.flat().map(({ answer, item }) => [item.id, answer]));
  const started = await startPlacementSitting({ goalId, input: { length } });

  if (started.status !== "ready" || !started.placement.attempt) {
    throw new Error("Expected a saved placement attempt");
  }

  const { id: attemptId, part } = started.placement.attempt;

  const answerNext = async (itemId: string | undefined, remaining: number): Promise<void> => {
    if (remaining === 0) {
      return;
    }

    const answer = itemId && answers.get(itemId);

    if (!itemId || !answer) {
      throw new Error("Expected the next question from the bank");
    }

    const result = await answerPlacementQuestion({
      goalId,
      input: { answer, attemptId, durationMs: 1000, itemId, part },
    });

    if (result.status !== "ready") {
      throw new Error(`Answer returned ${result.status}`);
    }

    await answerNext(result.placement.next?.itemId, remaining - 1);
  };

  await answerNext(started.placement.next?.itemId, 4);
  return finishGoalPlacement({ goalId, input: { attemptId, part } });
}

describe("placement Undo restores the plan", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { length: "quick", surface: "result" },
    { length: "wholeCourse", surface: "result" },
    { length: "quick", surface: "today" },
  ] as const)("restores both phases after $length Undo from $surface", async (scenario) => {
    const user = await userFixture();

    const { goal, plan, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [3, 2],
      userId: user.id,
    });

    await prisma.plan.update({ data: { phases: PHASES }, where: { id: plan.id } });
    mockSession(user.id);

    const [before, shown] = await Promise.all([readSchedule(goal.id), readPlanView(goal.id)]);
    expect(shown.phases.map(({ name }) => name)).toStrictEqual(PHASES.map(({ name }) => name));
    expect(shown.currentPhase).toBe(0);
    expect(shown.status).toBeNull();

    const finished = await finishPart({
      goalId: goal.id,
      length: scenario.length,
      skillIds: skills.map(({ id }) => id),
    });

    if (finished.status !== "ready" || !finished.completion.changeId) {
      throw new Error("Expected a finish that skips lessons and offers Undo");
    }

    expect(finished.completion.lessonsSkipped).toBeGreaterThan(0);

    expect(finished.completion.attempt?.partComplete ?? null).toBe(
      scenario.length === "wholeCourse" ? true : null,
    );

    await refreshTestedOutPlan({ goalId: goal.id, userId: user.id });

    await expect(loadPlanSnapshot(finished.completion.changeId)).resolves.toMatchObject({
      phases: before.phases,
      state: { graph: before.graph },
    });

    const todayChange =
      scenario.surface === "today" ? await loadTodayPlanChange({ goal, now: new Date() }) : null;

    expect(todayChange && { canUndo: todayChange.canUndo, id: todayChange.id }).toStrictEqual(
      scenario.surface === "today" ? { canUndo: true, id: finished.completion.changeId } : null,
    );

    await expect(
      decidePlanChange({
        changeId: todayChange?.id ?? finished.completion.changeId,
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ change: { status: "undone" }, status: "updated" });

    await expect(readPlanView(goal.id)).resolves.toStrictEqual(shown);
    await expect(readSchedule(goal.id)).resolves.toStrictEqual(before);
  });

  it("undoes when the finish's reschedule lands while Undo reads the plan", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [3],
      userId: user.id,
    });

    mockSession(user.id);
    const before = await readSchedule(goal.id);

    const finished = await finishPart({
      goalId: goal.id,
      length: "quick",
      skillIds: skills.map(({ id }) => id),
    });

    if (finished.status !== "ready" || !finished.completion.changeId) {
      throw new Error("Expected a finish that skips lessons and offers Undo");
    }

    // A commit between two of Undo's reads can't be timed from outside: once Undo has read the
    // plan's version, the reschedule the finish owes commits before Undo reads the rest.
    const readContext = planContext.loadPlanContext;
    const landed = { done: false };

    vi.spyOn(planContext, "loadPlanContext").mockImplementationOnce(async (input) => {
      landed.done = true;
      await refreshTestedOutPlan({ goalId: goal.id, userId: user.id });
      return readContext(input);
    });

    await expect(
      decidePlanChange({
        changeId: finished.completion.changeId,
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ change: { status: "undone" }, status: "updated" });

    expect(landed.done).toBe(true);
    await expect(readSchedule(goal.id)).resolves.toStrictEqual(before);
  });
});
