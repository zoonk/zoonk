import { randomUUID } from "node:crypto";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { lessonRunFixture } from "./_test-utils/lesson-run-fixture";
import { setupPlayableLesson, stepOfKind } from "./_test-utils/playable-lesson-setup";
import { getLessonProgress } from "./get-lesson-progress";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

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
      // Before the lesson was first left unfinished: another time the learner played it.
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

    await expect(getLessonProgress({ lessonId: lesson.id })).resolves.toStrictEqual([
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
