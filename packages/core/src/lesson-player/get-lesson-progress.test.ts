import { randomUUID } from "node:crypto";
import { gradeTypedAnswer } from "@zoonk/ai/tasks/grading/grade-typed-answer";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { lessonRunFixture } from "./_test-utils/lesson-run-fixture";
import { setupPlayableLesson, stepOfKind } from "./_test-utils/playable-lesson-setup";
import { typedGrade } from "./_test-utils/typed-grade";
import { checkLessonStep } from "./check-lesson-step";
import { type LessonStepAnswer } from "./contract";
import { getLessonProgress, hasStartedLesson } from "./get-lesson-progress";
import { startLibraryLesson } from "./start-library-lesson";

describe(getLessonProgress, () => {
  it("reads the answers of the sittings the learner left unfinished this week, oldest first", async () => {
    const { lesson, steps, user } = await setupPlayableLesson();
    const check = stepOfKind(steps, "check");
    const typed = stepOfKind(steps, "typedAnswer");
    const firstSitting = new Date(Date.now() - 3 * MS_PER_DAY);
    const secondSitting = new Date(Date.now() - MS_PER_DAY);

    await Promise.all([
      lessonRunFixture({ lessonId: lesson.id, startedAt: firstSitting, userId: user.id }),
      lessonRunFixture({ lessonId: lesson.id, startedAt: secondSitting, userId: user.id }),
      attemptFixture({
        answeredAt: new Date(firstSitting.getTime() - 1000),
        stepId: typed.id,
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: new Date(firstSitting.getTime() + 1000),
        isCorrect: false,
        stepId: check.id,
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: new Date(secondSitting.getTime() + 1000),
        stepId: typed.id,
        userId: user.id,
      }),
    ]);

    const progress = await getLessonProgress({ lessonId: lesson.id });

    expect(
      progress.map(({ answeredAt, isCorrect, stepId }) => ({ answeredAt, isCorrect, stepId })),
    ).toStrictEqual([
      {
        answeredAt: new Date(firstSitting.getTime() + 1000).toISOString(),
        isCorrect: false,
        stepId: check.id,
      },
      {
        answeredAt: new Date(secondSitting.getTime() + 1000).toISOString(),
        isCorrect: true,
        stepId: typed.id,
      },
    ]);
  });

  it("brings back each answer with the same answer and result as starting the lesson does", async () => {
    const { lesson, steps, user } = await setupPlayableLesson({
      steps: ["check", "activity", "typedAnswer", "spokenAnswer", "summary"],
    });

    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });
    const checkId = stepOfKind(steps, "check").id;

    const answer = (stepId: string, given: LessonStepAnswer) =>
      checkLessonStep({
        input: { answer: given, durationMs: 8000, runId: run.id, timeZone: "UTC" },
        stepId,
      });

    vi.mocked(gradeTypedAnswer).mockResolvedValueOnce(
      typedGrade({ feedback: "Only half.", isCorrect: false, score: 0.4 }),
    );

    const numeric = { answer: { kind: "numeric", value: 4 }, kind: "activity" } as const;
    const typed = { kind: "typedAnswer", text: "It's where the electron is" } as const;

    await answer(checkId, { kind: "check", optionId: "path" });
    await answer(stepOfKind(steps, "activity").id, numeric);
    await answer(stepOfKind(steps, "typedAnswer").id, typed);

    await attemptFixture({
      answer: { kind: "spoken", transcript: "The electron is a crowd" },
      answeredAt: new Date(Date.now() + 1000),
      isCorrect: false,
      stepId: stepOfKind(steps, "spokenAnswer").id,
      userId: user.id,
    });

    await attemptFixture({
      answeredAt: new Date(Date.now() + 2000),
      stepId: checkId,
      userId: user.id,
    });

    const progress = await getLessonProgress({ lessonId: lesson.id });

    const started = await startLibraryLesson({
      input: { runId: run.id, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    expect(progress.map((item) => item.answer)).toStrictEqual([
      { kind: "check", optionId: "path" },
      numeric,
      typed,
      null,
      null,
    ]);

    expect(started.status === "started" && started.run.answers).toStrictEqual(progress);
  });

  it("has nothing without a session, an unfinished sitting this week, or for another learner", async () => {
    const { lesson, steps, user } = await setupPlayableLesson();
    const check = stepOfKind(steps, "check");
    const stranger = await userFixture();

    await Promise.all([
      lessonRunFixture({
        lessonId: lesson.id,
        startedAt: new Date(Date.now() - 8 * MS_PER_DAY),
        userId: user.id,
      }),
      lessonRunFixture({ endedAt: new Date(), lessonId: lesson.id, userId: user.id }),
      lessonRunFixture({ lessonId: lesson.id, userId: stranger.id }),
    ]);

    await attemptFixture({ stepId: check.id, userId: user.id });

    await expect(getLessonProgress({ lessonId: lesson.id })).resolves.toStrictEqual([]);
    await expect(getLessonProgress({ lessonId: randomUUID() })).resolves.toStrictEqual([]);

    mockSession(null);

    await expect(getLessonProgress({ lessonId: lesson.id })).resolves.toStrictEqual([]);
  });
});

describe(hasStartedLesson, () => {
  it("counts a lesson as started once its unfinished sitting has an answer", async () => {
    const { lesson, steps, user } = await setupPlayableLesson();
    const run = await lessonRunFixture({ lessonId: lesson.id, userId: user.id });

    await expect(hasStartedLesson({ lessonId: lesson.id })).resolves.toBe(false);

    await attemptFixture({
      answeredAt: new Date(run.startedAt.getTime() + 1000),
      stepId: stepOfKind(steps, "check").id,
      userId: user.id,
    });

    await expect(hasStartedLesson({ lessonId: lesson.id })).resolves.toBe(true);
  });
});
