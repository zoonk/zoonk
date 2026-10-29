import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { mockSession } from "../../../../../../../../packages/core/src/_test-utils/mock-session";
import {
  planLibraryFixture,
  unplannedGoalFixture,
} from "../../../../../../../../packages/core/src/plans/_test-utils/plan-library";
import { createGoalPlan } from "../../../../../../../../packages/core/src/plans/create-goal-plan";
import { sessionPreparationWorkflow } from "../../../../../workflows/v2/sessions/session-preparation-workflow";
import { GET as readToday } from "../../../today/route";
import { POST as prepareLessons } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

const NOW = new Date("2026-09-30T12:00:00Z");

async function readEmptyDay(goalId: string): Promise<unknown> {
  const response = await readToday(
    new NextRequest(`http://localhost/v1/today?goalId=${goalId}&timeZone=UTC`),
  );

  const today = await response.json();
  return today.session.emptyDay;
}

describe("POST /v1/goals/{goalId}/lesson-preparations", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("prepares a day's lessons nobody is outlining, and the next read says they're coming", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ outlineStatus: "completed" }),
    ]);

    const library = await planLibraryFixture({ skills: [{ lessons: 0, size: 4 }] });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 45,
      primaryCourseId: course.id,
      settings: { startDate: "2026-09-30" },
      timezone: "UTC",
      userId: user.id,
    });

    await Promise.all([
      createGoalPlan({ goalId: goal.id, graph: library.graph }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    mockSession(user.id);
    vi.mocked(start).mockResolvedValue({ runId: "wrun_prep" } as Awaited<ReturnType<typeof start>>);

    await expect(readEmptyDay(goal.id)).resolves.toBe("lessonsToPrepare");

    const response = await prepareLessons(
      new NextRequest(`http://localhost/v1/goals/${goal.id}/lesson-preparations`, {
        method: "POST",
      }),
      { params: Promise.resolve({ goalId: goal.id }) },
    );

    expect(response.status).toBe(202);
    expect(vi.mocked(start)).toHaveBeenCalledWith(sessionPreparationWorkflow, expect.anything());
    await expect(readEmptyDay(goal.id)).resolves.toBe("lessonsComing");
  });
});
