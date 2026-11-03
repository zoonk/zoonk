import { randomUUID } from "node:crypto";
import { type LearningEvent } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { lessonRunFixture } from "../lesson-player/_test-utils/lesson-run-fixture";
import { completedLessonListInputSchema } from "./contract";
import { listCurrentUserCompletedLessons } from "./list-current-user-completed-lessons";

function finishedRun({
  endedAt,
  goalId = null,
  kind = "lesson",
  lessonId,
  lessonKind = "library",
  localDate = new Date(`${endedAt.slice(0, 10)}T00:00:00.000Z`),
  userId,
}: Pick<LearningEvent, "userId"> & {
  endedAt: string;
  goalId?: string | null;
  kind?: LearningEvent["kind"];
  lessonId: string;
  lessonKind?: string;
  localDate?: Date;
}) {
  return learningEventFixture({
    contentIds: { lessonId },
    endedAt: new Date(endedAt),
    goalId,
    kind,
    lessonKind,
    localDate,
    userId,
  });
}

async function learnerWithGoals() {
  const user = await userFixture();

  const [goal, otherGoal] = await Promise.all([
    goalFixture({ userId: user.id }),
    goalFixture({ userId: user.id }),
  ]);

  mockSession(user.id);
  return { goal, otherGoal, user };
}

async function listFor(goalId: string, page: { limit?: number; offset?: number } = {}) {
  const result = await listCurrentUserCompletedLessons(
    completedLessonListInputSchema.parse({ goalId, ...page }),
  );

  if (result.status !== "ready") {
    throw new Error(`Expected completed lessons, got ${result.status}`);
  }

  return result;
}

describe(listCurrentUserCompletedLessons, () => {
  it("requires a signed-in learner", async () => {
    mockSession(null);

    await expect(
      listCurrentUserCompletedLessons(
        completedLessonListInputSchema.parse({ goalId: randomUUID() }),
      ),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("hides another learner's goal", async () => {
    const [{ goal }, stranger] = await Promise.all([learnerWithGoals(), userFixture()]);
    mockSession(stranger.id);

    await expect(
      listCurrentUserCompletedLessons(completedLessonListInputSchema.parse({ goalId: goal.id })),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("lists a lesson once, under the learner-local day it was last finished", async () => {
    const { goal, user } = await learnerWithGoals();
    const chapter = await libraryChapterFixture({ title: "Waves" });

    const [replayed, single] = await Promise.all([
      libraryLessonFixture({ homeChapterId: chapter.id, title: "Interference" }),
      libraryLessonFixture({ title: "Explained by you" }),
    ]);

    await Promise.all([
      finishedRun({
        endedAt: "2026-10-20T15:00:00.000Z",
        goalId: goal.id,
        lessonId: replayed.id,
        userId: user.id,
      }),
      finishedRun({
        endedAt: "2026-10-25T15:00:00.000Z",
        goalId: goal.id,
        lessonId: single.id,
        userId: user.id,
      }),
      finishedRun({
        endedAt: "2026-10-30T01:00:00.000Z",
        goalId: goal.id,
        kind: "review",
        lessonId: replayed.id,
        localDate: new Date("2026-10-29T00:00:00.000Z"),
        userId: user.id,
      }),
    ]);

    await expect(listFor(goal.id)).resolves.toStrictEqual({
      hasMore: false,
      lessons: [
        {
          chapterTitle: "Waves",
          finishedOn: "2026-10-29",
          lessonId: replayed.id,
          title: "Interference",
        },
        {
          chapterTitle: null,
          finishedOn: "2026-10-25",
          lessonId: single.id,
          title: "Explained by you",
        },
      ],
      status: "ready",
    });
  });

  it("lists the goal's plan lessons wherever they were finished, and other goals' lessons only in their plan", async () => {
    const { goal, otherGoal, user } = await learnerWithGoals();

    const [inPlan, outsidePlan, otherGoalOnly] = await Promise.all([
      libraryLessonFixture(),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      planFixture({ goalId: goal.id, items: [{ lessonId: inPlan.id }] }),
      finishedRun({
        endedAt: "2026-10-20T15:00:00.000Z",
        goalId: otherGoal.id,
        lessonId: inPlan.id,
        userId: user.id,
      }),
      finishedRun({
        endedAt: "2026-10-21T15:00:00.000Z",
        goalId: goal.id,
        lessonId: outsidePlan.id,
        userId: user.id,
      }),
      finishedRun({
        endedAt: "2026-10-22T15:00:00.000Z",
        goalId: otherGoal.id,
        lessonId: otherGoalOnly.id,
        userId: user.id,
      }),
    ]);

    const [listed, otherListed] = await Promise.all([listFor(goal.id), listFor(otherGoal.id)]);

    expect(listed.lessons.map((lesson) => lesson.lessonId)).toStrictEqual([
      outsidePlan.id,
      inPlan.id,
    ]);

    expect(otherListed.lessons.map((lesson) => lesson.lessonId)).toStrictEqual([
      otherGoalOnly.id,
      inPlan.id,
    ]);
  });

  it("leaves out review capsules, unfinished runs and other learners' runs", async () => {
    const [{ goal, user }, other] = await Promise.all([learnerWithGoals(), userFixture()]);
    const lesson = await libraryLessonFixture();

    await Promise.all([
      planFixture({ goalId: goal.id, items: [{ lessonId: lesson.id }] }),
      finishedRun({
        endedAt: "2026-10-20T15:00:00.000Z",
        goalId: goal.id,
        kind: "review",
        lessonId: lesson.id,
        lessonKind: "capsule",
        userId: user.id,
      }),
      lessonRunFixture({ lessonId: lesson.id, userId: user.id }),
      finishedRun({ endedAt: "2026-10-21T15:00:00.000Z", lessonId: lesson.id, userId: other.id }),
    ]);

    await expect(listFor(goal.id)).resolves.toStrictEqual({
      hasMore: false,
      lessons: [],
      status: "ready",
    });
  });

  it("pages newest first", async () => {
    const { goal, user } = await learnerWithGoals();
    const lessons = await Promise.all([1, 2, 3].map(() => libraryLessonFixture()));

    await Promise.all(
      lessons.map((lesson, index) =>
        finishedRun({
          endedAt: `2026-10-2${index}T15:00:00.000Z`,
          goalId: goal.id,
          lessonId: lesson.id,
          userId: user.id,
        }),
      ),
    );

    const [first, second] = await Promise.all([
      listFor(goal.id, { limit: 2 }),
      listFor(goal.id, { limit: 2, offset: 2 }),
    ]);

    expect(first.hasMore).toBe(true);

    expect(first.lessons.map((lesson) => lesson.lessonId)).toStrictEqual([
      lessons[2]?.id,
      lessons[1]?.id,
    ]);

    expect(second).toStrictEqual({
      hasMore: false,
      lessons: [expect.objectContaining({ lessonId: lessons[0]?.id })],
      status: "ready",
    });
  });
});
