import { goalContentWorkflow } from "@/workflows/v2/goals/goal-content-workflow";
import { researchWorkflow } from "@/workflows/v2/research/research-workflow";
import { type GoalView } from "@zoonk/core/goals/contract";
import { startCourseGoal } from "@zoonk/core/goals/start-course";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { POST as startFromCourse } from "./route";

// Core's DB suite covers who may start which course and the goal it makes; this adapter test
// covers which runs a start sets off.
vi.mock("@zoonk/core/goals/start-course", () => ({ startCourseGoal: vi.fn() }));
vi.mock("@/workflows/v2/goals/goal-content-workflow", () => ({ goalContentWorkflow: vi.fn() }));
vi.mock("@/workflows/v2/research/research-workflow", () => ({ researchWorkflow: vi.fn() }));

// Its goal is a stand-in, not a stored one: the run starts as for a goal with none yet. Saving the
// run on the goal is covered by POST /goals/{goalId}/generations' database tests.
vi.mock("@zoonk/core/goals/generation-id", () => ({
  getGoalGenerationId: vi.fn(async () => ({ generationId: null, status: "ready" })),
}));

vi.mock("@zoonk/core/goals/record-generation", () => ({ recordGoalGeneration: vi.fn() }));

const COURSE_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190b";
const GOAL_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190c";

function startRequest() {
  return startFromCourse(
    new NextRequest(`http://localhost/v1/courses/${COURSE_ID}/goals`, {
      body: JSON.stringify({}),
      method: "POST",
    }),
    { params: Promise.resolve({ courseId: COURSE_ID }) },
  );
}

function createdGoal(goal: Pick<GoalView, "examBlueprintId" | "kind">) {
  vi.mocked(startCourseGoal).mockResolvedValue({
    goal: { id: GOAL_ID, ...goal } as GoalView,
    status: "created",
  });
}

describe("POST /v1/courses/{courseId}/goals", () => {
  beforeEach(() => {
    vi.mocked(start).mockImplementation(
      async (workflow) =>
        ({
          runId: Object.is(workflow, researchWorkflow) ? "wrun_research" : "wrun_goal",
        }) as Awaited<ReturnType<typeof start>>,
    );
  });

  // An exam course from before the Library has no stored exam: its plan waited for nothing to
  // read the exam's notice, so it was planned as a general course.
  it("reads the notice of an exam course nobody stored an exam for before writing its plan", async () => {
    createdGoal({ examBlueprintId: null, kind: "exam" });

    const response = await startRequest();
    expect(response.status).toBe(201);

    expect(start).toHaveBeenCalledWith(researchWorkflow, [{ goalId: GOAL_ID }]);

    expect(start).toHaveBeenCalledWith(goalContentWorkflow, [
      expect.objectContaining({ goalId: GOAL_ID, researchId: "wrun_research" }),
    ]);
  });

  it.each([
    ["an exam course with its stored exam", { examBlueprintId: GOAL_ID, kind: "exam" as const }],
    ["a learn course", { examBlueprintId: null, kind: "learn" as const }],
  ])("starts only the plan's run for %s", async (_label, goal) => {
    createdGoal(goal);

    await startRequest();

    expect(start).toHaveBeenCalledExactlyOnceWith(goalContentWorkflow, [
      expect.objectContaining({ goalId: GOAL_ID, researchId: null }),
    ]);
  });
});
