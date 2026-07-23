import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getLearningActivity } from "./get-learning-activity";

const NOW = new Date("2025-01-10T12:00:00Z");

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getLearningActivity({ now: NOW });

    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns empty lifetime totals and a complete calendar window without progress", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    const result = await getLearningActivity({ now: NOW });

    expect(result).toMatchObject({
      learningDays: 0,
      totalLearningSeconds: 0,
      totalLessonCompletions: 0,
    });

    expect(result?.days).toHaveLength(370);

    expect(result?.days.at(0)).toStrictEqual({
      date: new Date("2024-01-07T00:00:00Z"),
      lessonCompletions: 0,
    });

    expect(result?.days.at(-1)).toStrictEqual({
      date: new Date("2025-01-10T00:00:00Z"),
      lessonCompletions: 0,
    });
  });

  it("ends an empty calendar on the learner's current local date", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    const result = await getLearningActivity({ now: NOW, timeZone: "Pacific/Kiritimati" });

    expect(result?.days.at(-1)).toStrictEqual({
      date: new Date("2025-01-11T00:00:00Z"),
      lessonCompletions: 0,
    });
  });

  it("uses each lesson's first completion for the lifetime total and calendar", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
    await signInAsCurrentUser({ email: user.email, password: user.password });

    const course = await courseFixture();
    const chapter = await chapterFixture({ courseId: course.id });

    const [historicalLesson, firstLesson, secondLesson, incompleteLesson, otherLesson] =
      await Promise.all([
        lessonFixture({ chapterId: chapter.id }),
        lessonFixture({ chapterId: chapter.id }),
        lessonFixture({ chapterId: chapter.id }),
        lessonFixture({ chapterId: chapter.id }),
        lessonFixture({ chapterId: chapter.id }),
      ]);

    await Promise.all([
      dailyProgressFixtureMany([
        {
          date: new Date("2024-01-01T00:00:00Z"),
          staticCompleted: 2,
          timeSpentSeconds: 60,
          userId: user.id,
        },
        {
          date: new Date("2025-01-05T00:00:00Z"),
          interactiveCompleted: 1,
          staticCompleted: 2,
          timeSpentSeconds: 120,
          userId: user.id,
        },
        { date: new Date("2025-01-06T00:00:00Z"), timeSpentSeconds: 30, userId: user.id },
        {
          date: new Date("2025-01-08T00:00:00Z"),
          staticCompleted: 1,
          timeSpentSeconds: 45,
          userId: user.id,
        },
        {
          date: new Date("2025-01-05T00:00:00Z"),
          interactiveCompleted: 5,
          timeSpentSeconds: 600,
          userId: otherUser.id,
        },
      ]),
      lessonProgressFixture({
        completedAt: new Date("2024-01-01T12:00:00Z"),
        durationSeconds: 60,
        lessonId: historicalLesson.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2025-01-05T12:00:00Z"),
        durationSeconds: 60,
        lessonId: firstLesson.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2025-01-08T12:00:00Z"),
        durationSeconds: 60,
        lessonId: secondLesson.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: null,
        durationSeconds: null,
        lessonId: incompleteLesson.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2025-01-05T12:00:00Z"),
        durationSeconds: 60,
        lessonId: otherLesson.id,
        userId: otherUser.id,
      }),
    ]);

    const result = await getLearningActivity({ now: NOW });

    expect(result).toMatchObject({
      learningDays: 3,
      totalLearningSeconds: 255,
      totalLessonCompletions: 3,
    });

    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-05T00:00:00Z").getTime()),
    ).toStrictEqual({ date: new Date("2025-01-05T00:00:00Z"), lessonCompletions: 1 });

    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-06T00:00:00Z").getTime()),
    ).toStrictEqual({ date: new Date("2025-01-06T00:00:00Z"), lessonCompletions: 0 });

    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-08T00:00:00Z").getTime()),
    ).toStrictEqual({ date: new Date("2025-01-08T00:00:00Z"), lessonCompletions: 1 });

    expect(result?.days.some((day) => day.date < new Date("2024-01-07T00:00:00Z"))).toBe(false);
  });

  it("uses the learner-local completion date near the server day boundary", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    const course = await courseFixture();
    const chapter = await chapterFixture({ courseId: course.id });
    const lesson = await lessonFixture({ chapterId: chapter.id });

    await lessonProgressFixture({
      completedAt: new Date("2025-01-10T23:30:00Z"),
      completedDate: new Date("2025-01-11T00:00:00Z"),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: user.id,
    });

    const result = await getLearningActivity({ now: NOW, timeZone: "Pacific/Kiritimati" });

    expect(result?.days.at(-1)).toStrictEqual({
      date: new Date("2025-01-11T00:00:00Z"),
      lessonCompletions: 1,
    });
  });
});
