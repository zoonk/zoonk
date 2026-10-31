import { selectRelevantMemoryFacts } from "@zoonk/ai/tasks/memory/relevance";
import { generateMemorySearchTerms } from "@zoonk/ai/tasks/memory/search-terms";
import { fitPlanToRoutineFacts } from "@zoonk/ai/tasks/plans/routine-fit";
import { createGoalPlan } from "@zoonk/core/plans/create";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { taskResult } from "../_test-utils/recorded-outputs";
import { goalContentWorkflow } from "./goal-content-workflow";

vi.mock("@zoonk/ai/tasks/memory/search-terms", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateMemorySearchTerms: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/memory/relevance", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  selectRelevantMemoryFacts: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/plans/routine-fit", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fitPlanToRoutineFacts: vi.fn(),
}));

const TRIP = "Travels the week of October 5";

async function plannedGoalWithLargeMemory() {
  const user = await userFixture();

  const [goal, skill] = await Promise.all([
    goalFixture({ userId: user.id }),
    skillFixture(),
    learningProfileFixture({ memoryEnabled: true, userId: user.id }),
    memoryFactFixture({ category: "routine", statement: TRIP, userId: user.id }),
    ...Array.from({ length: 10 }, (_, index) =>
      memoryFactFixture({ category: "goals", statement: `Goal note ${index}`, userId: user.id }),
    ),
  ]);

  await createGoalPlan({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: [
        { area: null, lessons: 2, name: skill.name, phase: 0, skillId: skill.id, weight: null },
      ],
    },
  });

  // Its first lessons were prepared earlier, so the run only sets the plan up.
  await prisma.plan.update({
    data: { placementPreparedAt: new Date() },
    where: { goalId: goal.id },
  });

  return goal;
}

describe("a new plan's routine fit", () => {
  it("makes each model call in a step of its own, so a failed call retries alone", async () => {
    const goal = await plannedGoalWithLargeMemory();

    // No terms, so no text search: steps here share the test's Prisma client (`globalThis.prisma`),
    // whose raw queries don't take the step bundle's `sql` fragments.
    vi.mocked(generateMemorySearchTerms)
      .mockRejectedValueOnce(new Error("The gateway is down"))
      .mockResolvedValue(taskResult({ terms: [] }) as never);

    vi.mocked(selectRelevantMemoryFacts)
      .mockRejectedValueOnce(new Error("The gateway is down"))
      .mockImplementation(async ({ facts }) => facts.filter((fact) => fact.statement === TRIP));

    vi.mocked(fitPlanToRoutineFacts)
      .mockRejectedValueOnce(new Error("The provider is overloaded"))
      .mockResolvedValue(
        taskResult({
          operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
          reason: "Sundays are off while you travel.",
        }),
      );

    const run = await start(goalContentWorkflow, [{ goalId: goal.id }]);
    await expect(run.returnValue).resolves.toMatchObject({ status: "ready" });

    expect(generateMemorySearchTerms).toHaveBeenCalledTimes(2);
    expect(selectRelevantMemoryFacts).toHaveBeenCalledTimes(2);
    expect(fitPlanToRoutineFacts).toHaveBeenCalledTimes(2);

    expect(fitPlanToRoutineFacts).toHaveBeenLastCalledWith(
      expect.objectContaining({ memory: [TRIP] }),
    );

    const plan = await prisma.plan.findUniqueOrThrow({
      include: { changes: true },
      where: { goalId: goal.id },
    });

    expect(plan.setupTasks).toStrictEqual([]);

    expect(plan.changes).toMatchObject([
      { reason: "Sundays are off while you travel.", status: "applied" },
    ]);
  });
});
