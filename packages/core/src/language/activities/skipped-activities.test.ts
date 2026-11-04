import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { cacheTag, revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getGoalsCacheTag } from "../../cache/tags";
import { setupPlayableLesson } from "../../lesson-player/_test-utils/playable-lesson-setup";
import { completeLibraryLesson } from "../../lesson-player/complete-library-lesson";
import { getPlayableLibraryLesson } from "../../lesson-player/get-playable-library-lesson";
import { startLibraryLesson } from "../../lesson-player/start-library-lesson";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { parsePlanSettings } from "../../plans/planner/plan-state";

const TIME_ZONE = "UTC";

async function languageLessonSetup() {
  const setup = await setupPlayableLesson({ steps: ["explanation", "typedAnswer", "summary"] });

  await prisma.lesson.update({
    data: { language: "pt", targetLanguage: "en" },
    where: { id: setup.lesson.id },
  });

  const goal = await goalFixture({
    kind: "language",
    language: "pt",
    targetLanguage: "en",
    userId: setup.user.id,
  });

  const plan = await planFixture({ goalId: goal.id });

  return { ...setup, goal, plan };
}

async function skippedActivities(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  return parsePlanSettings(plan.settings).skippedActivities;
}

async function startAndComplete(lessonId: string) {
  const started = await startLibraryLesson({ input: { timeZone: TIME_ZONE }, lessonId });

  if (started.status !== "started") {
    throw new Error(started.status);
  }

  return completeLibraryLesson({
    input: { runId: started.run.runId, timeZone: TIME_ZONE },
    lessonId,
  });
}

describe("skipping language activities", () => {
  it("leaves writing out of the plan until it's brought back", async () => {
    const { goal, plan, user } = await languageLessonSetup();
    mockSession(user.id);

    await expect(skippedActivities(plan.id)).resolves.toStrictEqual([]);

    const skipped = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ activities: ["writing"], kind: "skipActivities" }] },
    });

    expect(skipped.status).toBe("applied");
    await expect(skippedActivities(plan.id)).resolves.toStrictEqual(["writing"]);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ activities: ["writing"], kind: "restoreActivities" }] },
    });

    await expect(skippedActivities(plan.id)).resolves.toStrictEqual([]);
  });

  it("finishes a language lesson without its writing screens once writing is skipped", async () => {
    const { goal, lesson, user } = await languageLessonSetup();
    mockSession(user.id);

    await expect(startAndComplete(lesson.id)).resolves.toStrictEqual({ status: "invalid" });

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ activities: ["writing"], kind: "skipActivities" }] },
    });

    await expect(startAndComplete(lesson.id)).resolves.toMatchObject({ status: "completed" });
  });

  it("serves a language lesson without the screens its plan skips, as every app plays it", async () => {
    const { goal, lesson, user } = await languageLessonSetup();
    mockSession(user.id);

    const kinds = async () => {
      const played = await getPlayableLibraryLesson({ lessonId: lesson.id });
      return played?.status === "ready" ? played.lesson.steps.map((step) => step.kind) : null;
    };

    await expect(kinds()).resolves.toStrictEqual(["explanation", "typedAnswer", "summary"]);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ activities: ["writing"], kind: "skipActivities" }] },
    });

    await expect(kinds()).resolves.toStrictEqual(["explanation", "summary"]);
  });

  it("keeps a learner's language lesson under a tag their plan changes expire", async () => {
    const { goal, lesson, user } = await languageLessonSetup();
    mockSession(user.id);

    vi.mocked(cacheTag).mockClear();
    await getPlayableLibraryLesson({ lessonId: lesson.id });
    const readTags = vi.mocked(cacheTag).mock.calls.flat();

    vi.mocked(revalidateTag).mockClear();

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ activities: ["writing"], kind: "skipActivities" }] },
    });

    const expiredTags = new Set(vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag));

    expect(readTags.filter((tag) => expiredTags.has(tag))).toContain(getGoalsCacheTag(user.id));
  });
});
