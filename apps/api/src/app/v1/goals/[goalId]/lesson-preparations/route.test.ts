import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { mockSession } from "../../../../../../../../packages/core/src/_test-utils/mock-session";
import { sessionPreparationWorkflow } from "../../../../../workflows/sessions/session-preparation-workflow";
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
    const [user, course, skill] = await Promise.all([
      userFixture(),
      courseFixture({ outlineStatus: "completed" }),
      skillFixture(),
    ]);

    const goal = await goalFixture({
      dailyMinutes: 45,
      primaryCourseId: course.id,
      timezone: "UTC",
      userId: user.id,
    });

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: [
          { area: null, lessons: 4, name: skill.name, phase: 0, skillId: skill.id, weight: null },
        ],
      },
      phases: [{ name: "Basics", startDate: "2026-09-30" }],
      settings: { startDate: "2026-09-30" },
    });

    await Promise.all([
      planItemFixture({ planId: plan.id, position: 0, scheduledFor: NOW, skillId: skill.id }),
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
