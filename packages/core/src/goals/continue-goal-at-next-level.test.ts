import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { courseGoalFixture } from "../view-models/_test-utils/course-goal";
import { continueGoalAtNextLevel } from "./continue-goal-at-next-level";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

async function setup(options: Omit<Parameters<typeof courseGoalFixture>[0], "userId"> = {}) {
  const user = await userFixture();
  const fixture = await courseGoalFixture({ ...options, userId: user.id });
  await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });
  mockSession(user.id);
  return { ...fixture, user };
}

const FINISHED = ["done", "done", "testedOut", "done"] as const;

describe(continueGoalAtNextLevel, () => {
  it("requires a session, the learner's own goal and a finished plan", async () => {
    const { goal } = await setup({ statuses: ["done", "done", "todo", "todo"] });

    await expect(continueGoalAtNextLevel(goal.id)).resolves.toStrictEqual({
      status: "notFinished",
    });

    mockSession(null);

    await expect(continueGoalAtNextLevel(goal.id)).resolves.toStrictEqual({
      status: "unauthorized",
    });

    const other = await userFixture();
    mockSession(other.id);
    await expect(continueGoalAtNextLevel(goal.id)).resolves.toStrictEqual({ status: "notFound" });
  });

  it("completes the finished goal and starts the course's next level in its place", async () => {
    const { course, goal, plan, user } = await setup({
      details: {
        level: "none",
        onboardingId: "onboarding-1",
        purpose: "overview",
        reason: "Curious",
      },
      statuses: [...FINISHED],
    });

    await prisma.plan.update({
      data: { settings: { weekdayMinutes: [0, 20, 20, 20, 20, 20, 0] } },
      where: { id: plan.id },
    });

    const flush = runDeferredWork();
    const result = await continueGoalAtNextLevel(goal.id);
    const next = result.status === "created" ? result.goal : null;
    await flush();

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Goal Reached",
        properties: { days: 0, goal_id: goal.id },
        shared: expect.objectContaining({ goal_kind: "learn" }),
      }),
    );

    expect(next).toMatchObject({
      isActive: true,
      kind: "learn",
      primaryCourseId: course.id,
      prompt: goal.prompt,
      studyDays: [1, 2, 3, 4, 5],
      title: "Quantum physics",
    });

    expect(next?.details).toStrictEqual({
      continuesFromGoalId: goal.id,
      courseLevel: "beginner",
      level: "basic",
      purpose: "deep",
      reason: "Curious",
    });

    const [finished, profile] = await Promise.all([
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ]);

    expect(finished.status).toBe("completed");
    expect(profile.activeGoalId).toBe(next?.id);
  });

  it("has no next level at the top of the course, nor for goals that aren't about learning", async () => {
    const { beginner, course, goal } = await setup({ statuses: [...FINISHED] });

    await prisma.courseChapter.delete({
      where: { courseId_chapterId: { chapterId: beginner.id, courseId: course.id } },
    });

    await prisma.courseChapter.updateMany({
      data: { level: "advanced" },
      where: { courseId: course.id },
    });

    await expect(continueGoalAtNextLevel(goal.id)).resolves.toStrictEqual({
      status: "noNextLevel",
    });

    const exam = await setup({ statuses: [...FINISHED] });
    await prisma.goal.update({ data: { kind: "exam" }, where: { id: exam.goal.id } });

    await expect(continueGoalAtNextLevel(exam.goal.id)).resolves.toStrictEqual({
      status: "noNextLevel",
    });

    const unchanged = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(unchanged.status).toBe("active");
  });
});
