import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { loadGoalCurriculumInputs } from "../library/curriculum/goal-curriculum-inputs";
import { courseGoalFixture } from "../view-models/_test-utils/course-goal";
import { continueGoalAtNextLevel } from "./continue-goal-at-next-level";
import { startCourseGoal } from "./start-course-goal";

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

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: next?.id } })).resolves.toMatchObject(
      { replacesGoalId: goal.id },
    );

    await expect(continueGoalAtNextLevel(goal.id)).resolves.toStrictEqual({
      status: "noNextLevel",
    });

    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(2);
  });

  it("continues a goal once, whatever the learner later writes in the next goal's details", async () => {
    const { goal, user } = await setup({ statuses: [...FINISHED] });
    const first = await continueGoalAtNextLevel(goal.id);
    const next = first.status === "created" ? first.goal : null;

    await prisma.goal.update({ data: { details: {} }, where: { id: next?.id } });

    await expect(continueGoalAtNextLevel(goal.id)).resolves.toStrictEqual({
      status: "noNextLevel",
    });

    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(2);
  });

  it("creates one next goal when the same goal is continued twice at once", async () => {
    const { goal, user } = await setup({ statuses: [...FINISHED] });

    const results = await Promise.all([
      continueGoalAtNextLevel(goal.id),
      continueGoalAtNextLevel(goal.id),
    ]);

    expect(results.map((result) => result.status).toSorted()).toStrictEqual([
      "created",
      "noNextLevel",
    ]);

    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(2);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      status: "completed",
    });
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

  it.each(["direct", "unlinked"] as const)(
    "keeps a %s course start at the next level",
    async (start) => {
      const user = await userFixture();

      const fixture = await courseGoalFixture({
        details: { courseStart: { chapterId: null } },
        statuses: ["done", "done", "testedOut", "done"],
        userId: user.id,
      });

      const source =
        start === "unlinked" ? await courseFixture({ isPublished: true, language: "pt" }) : null;

      await prisma.course.update({ data: { isPublished: true }, where: { id: fixture.course.id } });

      if (source) {
        const second = await courseFixture({ isPublished: true });

        await prisma.goal.update({
          data: { details: {}, sourceCourseId: source.id },
          where: { id: fixture.goal.id },
        });

        await prisma.plan.update({
          data: {
            graph: {
              skills: fixture.skills.map((skill, index) => ({
                courseIds: [index === 0 ? second.id : fixture.course.id],
                lessons: 1,
                name: skill.name,
                phase: 0,
                skillId: skill.id,
              })),
            },
          },
          where: { id: fixture.plan.id },
        });
      }

      await learningProfileFixture({
        activeGoalId: fixture.goal.id,
        homeCountry: "BR",
        userId: user.id,
      });

      mockSession(user.id);

      const result = await continueGoalAtNextLevel(fixture.goal.id);
      const next = result.status === "created" ? result.goal : null;
      const row = await prisma.goal.findUniqueOrThrow({ where: { id: next?.id ?? "" } });
      const inputs = await loadGoalCurriculumInputs(row.id);

      expect({
        contentCountry: row.contentCountry,
        courseStart: (row.details as Record<string, unknown>).courseStart ?? null,
        sourceCourseId: row.sourceCourseId,
        startedCourseId: inputs?.startedCourse?.id ?? null,
        unpinnedSource: inputs?.sourceCourse ?? null,
      }).toStrictEqual({
        contentCountry: fixture.course.country,
        courseStart: { chapterId: null },
        sourceCourseId: source?.id ?? null,
        startedCourseId: fixture.course.id,
        unpinnedSource: null,
      });

      await expect(
        startCourseGoal({ courseId: source?.id ?? fixture.course.id, input: { language: "pt" } }),
      ).resolves.toMatchObject({ goal: { id: row.id }, status: "existing" });
    },
  );
});
