import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { setupPlayableLesson } from "../../lesson-player/_test-utils/playable-lesson-setup";
import { completeLibraryLesson } from "../../lesson-player/complete-library-lesson";
import { getPlayableLibraryLesson } from "../../lesson-player/get-playable-library-lesson";
import { startLibraryLesson } from "../../lesson-player/start-library-lesson";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { getLanguageActivitySettings } from "./skipped-activities";

const TIME_ZONE = "UTC";

/** A written English lesson for a Portuguese speaker with a plan for English. */
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

    await expect(getLanguageActivitySettings({ targetLanguage: "en" })).resolves.toStrictEqual({
      skipped: [],
    });

    const skipped = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ activities: ["writing"], kind: "skipActivities" }] },
    });

    expect(skipped.status).toBe("applied");

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(saved.settings).skippedActivities).toStrictEqual(["writing"]);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ activities: ["writing"], kind: "restoreActivities" }] },
    });

    await expect(getLanguageActivitySettings({ targetLanguage: "en" })).resolves.toStrictEqual({
      skipped: [],
    });
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

  it("offers nothing to change without a goal for the language", async () => {
    const { user } = await setupPlayableLesson();
    mockSession(user.id);

    await expect(getLanguageActivitySettings({ targetLanguage: "ja" })).resolves.toBeNull();
  });
});
