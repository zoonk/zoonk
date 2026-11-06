import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import {
  setupPlayableLesson,
  stepOfKind,
} from "../../lesson-player/_test-utils/playable-lesson-setup";
import { checkLessonStep } from "../../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../../lesson-player/complete-library-lesson";
import { getPlayableLibraryLesson } from "../../lesson-player/get-playable-library-lesson";
import { startLibraryLesson } from "../../lesson-player/start-library-lesson";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { parsePlanSettings } from "../../plans/planner/plan-state";

const TIME_ZONE = "UTC";

async function languageLessonSetup(
  steps: NonNullable<Parameters<typeof setupPlayableLesson>[0]>["steps"] = [
    "explanation",
    "typedAnswer",
    "summary",
  ],
) {
  const setup = await setupPlayableLesson({ steps });

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

  it("finishes screens read while writing was skipped after writing comes back", async () => {
    const { goal, lesson, user } = await languageLessonSetup();
    mockSession(user.id);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ activities: ["writing"], kind: "skipActivities" }] },
    });

    const shown = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(shown?.status === "ready" && shown.lesson.steps.map((step) => step.kind)).toStrictEqual([
      "explanation",
      "summary",
    ]);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ activities: ["writing"], kind: "restoreActivities" }] },
    });

    await expect(startAndComplete(lesson.id)).resolves.toMatchObject({ status: "completed" });
  });

  it("requires the screens no plan leaves out and counts the writing the learner did", async () => {
    const { lesson, steps, user } = await languageLessonSetup([
      "check",
      "typedAnswer",
      "typedAnswer",
      "summary",
    ]);

    mockSession(user.id);

    const started = await startLibraryLesson({
      input: { timeZone: TIME_ZONE },
      lessonId: lesson.id,
    });

    if (started.status !== "started") {
      throw new Error(started.status);
    }

    const answer = (
      stepId: string,
      value: Parameters<typeof checkLessonStep>[0]["input"]["answer"],
    ) =>
      checkLessonStep({
        input: { answer: value, durationMs: 5000, runId: started.run.runId, timeZone: TIME_ZONE },
        stepId,
      });

    const complete = () =>
      completeLibraryLesson({
        input: { runId: started.run.runId, timeZone: TIME_ZONE },
        lessonId: lesson.id,
      });

    await answer(stepOfKind(steps, "typedAnswer").id, {
      kind: "typedAnswer",
      text: "It shows where the electron is likely to be",
    });

    await expect(complete()).resolves.toStrictEqual({ status: "invalid" });

    await answer(stepOfKind(steps, "check").id, { kind: "check", optionId: "likely" });

    await expect(complete()).resolves.toMatchObject({
      completion: { correctCount: 2 },
      status: "completed",
    });
  });

  it("finishes the screens a plan without speaking served after the learner can't write now", async () => {
    const { goal, lesson, steps, user } = await languageLessonSetup([
      "typedAnswer",
      "spokenAnswer",
      "summary",
    ]);

    mockSession(user.id);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ activities: ["speaking"], kind: "skipActivities" }] },
    });

    const started = await startLibraryLesson({
      input: { timeZone: TIME_ZONE },
      lessonId: lesson.id,
    });

    if (started.status !== "started") {
      throw new Error(started.status);
    }

    await expect(
      completeLibraryLesson({
        input: {
          runId: started.run.runId,
          skippedWritingStepIds: [stepOfKind(steps, "typedAnswer").id],
          timeZone: TIME_ZONE,
        },
        lessonId: lesson.id,
      }),
    ).resolves.toMatchObject({ status: "completed" });
  });

  it("never accepts a lesson with only its summary done, since no plan serves one", async () => {
    const { lesson, user } = await languageLessonSetup(["typedAnswer", "summary"]);
    mockSession(user.id);

    await expect(startAndComplete(lesson.id)).resolves.toStrictEqual({ status: "invalid" });
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

  it("follows the goal the learner chose when another goal for the language changed more recently", async () => {
    const { goal, lesson, user } = await languageLessonSetup();
    mockSession(user.id);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ activities: ["writing"], kind: "skipActivities" }] },
    });

    const other = await goalFixture({
      kind: "language",
      language: "pt",
      targetLanguage: "en",
      userId: user.id,
    });

    await Promise.all([
      planFixture({ goalId: other.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    const played = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(
      played?.status === "ready" ? played.lesson.steps.map((step) => step.kind) : null,
    ).toStrictEqual(["explanation", "summary"]);

    await expect(startAndComplete(lesson.id)).resolves.toMatchObject({ status: "completed" });
  });
});
