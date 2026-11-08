import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { after } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { analytics } from "../_test-utils/test-boundaries";
import { moveLanguageGoalToExam } from "../exams/move-language-goal";
import { trackOnboardingProgress } from "./track-onboarding-progress";

describe(trackOnboardingProgress, () => {
  it("queues analytics without waiting for its reads or delivery", async () => {
    const user = await userFixture();
    const onboardingId = crypto.randomUUID();
    const goal = await goalFixture({ details: { onboardingId }, userId: user.id });
    const pending: Parameters<typeof after>[0][] = [];

    vi.mocked(after).mockImplementation((work) => {
      pending.push(work);
    });

    trackOnboardingProgress({
      at: 1234,
      goalId: goal.id,
      question: "level",
      stage: "question_answered",
    });

    expect(analytics.trackServerEvent).not.toHaveBeenCalled();
    await Promise.all(pending.map((work) => (typeof work === "function" ? work() : work)));

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: user.id,
        properties: {
          at: 1234,
          goal_id: goal.id,
          onboarding_id: onboardingId,
          question: "level",
          stage: "question_answered",
        },
      }),
    );
  });

  it.each(["warm", "cold"] as const)(
    "marks a %s first lesson from the stored lesson and goal",
    async (cache) => {
      const user = await userFixture();

      const [goal, lesson] = await Promise.all([
        goalFixture({ createdAt: new Date("2026-11-08T12:00:00Z"), userId: user.id }),
        libraryLessonFixture({
          contentStatus: "completed",
          createdAt: new Date(cache === "warm" ? "2026-11-07T12:00:00Z" : "2026-11-08T12:00:01Z"),
        }),
      ]);

      const flush = runDeferredWork();

      trackOnboardingProgress({
        at: 1234,
        goalId: goal.id,
        lesson_id: lesson.id,
        platform: null,
        stage: "run_step",
        status: "completed",
        step: "firstLessonReady",
      });

      await flush();

      expect(analytics.trackServerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({ cache, goal_id: goal.id, lesson_id: lesson.id }),
        }),
      );
    },
  );

  it("respects the learner's usage-data choice", async () => {
    const user = await userFixture();
    await prisma.userLearningProfile.create({ data: { shareUsageData: false, userId: user.id } });
    const goal = await goalFixture({ userId: user.id });
    const flush = runDeferredWork();
    trackOnboardingProgress({ at: 1234, goalId: goal.id, stage: "goal_created" });
    await flush();
    expect(analytics.trackServerEvent).not.toHaveBeenCalled();
  });

  it("joins a language attempt to the exam goal its certificate answer creates", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const onboardingId = crypto.randomUUID();

    const language = await goalFixture({
      details: { onboardingId, reason: "Pass IELTS" },
      kind: "language",
      targetLanguage: "en",
      userId: user.id,
    });

    const pending: Parameters<typeof after>[0][] = [];

    vi.mocked(after).mockImplementation((work) => {
      pending.push(work);
    });

    const moved = await moveLanguageGoalToExam(language.id);

    if (moved.status !== "moved") {
      throw new Error("Expected an exam goal");
    }

    await Promise.all(pending.map((work) => (typeof work === "function" ? work() : work)));

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          goal_id: moved.goal.id,
          onboarding_id: onboardingId,
          stage: "goal_created",
        }),
      }),
    );
  });
});
