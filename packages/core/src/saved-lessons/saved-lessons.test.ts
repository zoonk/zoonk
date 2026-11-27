import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockAccountSession, mockSession } from "../_test-utils/mock-session";
import { completedLessonListInputSchema } from "../completed-lessons/contract";
import { listCurrentUserCompletedLessons } from "../completed-lessons/list-current-user-completed-lessons";
import { getLearnerSummary } from "../learner/summary/get-learner-summary";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { listCurrentUserSavedLessons } from "./list-saved-lessons";
import { saveLesson } from "./save-lesson";

async function signedInLearner() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  mockAccountSession({ user });
  return { goal, user };
}

describe("Saved lessons", () => {
  it("agrees with replay and Completed lessons when a lesson loses its published steps", async () => {
    const [{ goal, user }, { lesson }] = await Promise.all([
      signedInLearner(),
      playableLessonFixture({ steps: ["check"] }),
    ]);

    await learningEventFixture({
      contentIds: { lessonId: lesson.id },
      endedAt: new Date(),
      goalId: goal.id,
      lessonKind: "library",
      userId: user.id,
    });

    const input = { goalId: goal.id, lessonId: lesson.id };

    const completed = () =>
      listCurrentUserCompletedLessons(completedLessonListInputSchema.parse({ goalId: goal.id }));

    const replay = () => startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id });

    await expect(saveLesson({ ...input, saved: true })).resolves.toStrictEqual({
      saved: true,
      status: "ready",
    });

    await expect(replay()).resolves.toMatchObject({ run: { replay: true }, status: "started" });

    await expect(listCurrentUserSavedLessons(input)).resolves.toMatchObject({
      lessons: [{ available: true, lessonId: lesson.id }],
    });

    await expect(completed()).resolves.toMatchObject({
      lessons: [{ available: true, lessonId: lesson.id, saved: true }],
    });

    await prisma.step.updateMany({
      data: { retiredAt: new Date() },
      where: { lessonId: lesson.id },
    });

    await expect(saveLesson({ ...input, saved: true })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(replay()).resolves.toStrictEqual({ status: "notFound" });

    await expect(listCurrentUserSavedLessons(input)).resolves.toMatchObject({
      lessons: [{ available: false, lessonId: lesson.id }],
    });

    await expect(completed()).resolves.toMatchObject({
      lessons: [{ available: false, lessonId: lesson.id, saved: true }],
    });
  });

  it("applies the desired state and keeps the first save when requests repeat", async () => {
    const [{ goal, user }, { lesson }] = await Promise.all([
      signedInLearner(),
      playableLessonFixture({ steps: ["check"] }),
    ]);

    const input = { goalId: goal.id, lessonId: lesson.id };
    const where = { userLesson: { lessonId: lesson.id, userId: user.id } };

    await expect(saveLesson({ ...input, saved: true })).resolves.toStrictEqual({
      saved: true,
      status: "ready",
    });

    const original = await prisma.savedLesson.findUniqueOrThrow({ where });
    const otherGoal = await goalFixture({ userId: user.id });

    await expect(
      saveLesson({ ...input, goalId: otherGoal.id, saved: true }),
    ).resolves.toStrictEqual({ saved: true, status: "ready" });

    await expect(prisma.savedLesson.findUnique({ where })).resolves.toStrictEqual(original);

    await expect(
      saveLesson({ ...input, goalId: otherGoal.id, saved: false }),
    ).resolves.toStrictEqual({ saved: false, status: "ready" });

    await expect(saveLesson({ ...input, saved: false })).resolves.toStrictEqual({
      saved: false,
      status: "ready",
    });

    await expect(prisma.savedLesson.findUnique({ where })).resolves.toBeNull();
  });

  it("rejects unwritten lessons and private lessons owned by someone else", async () => {
    const [{ goal, user }, owner, unwritten] = await Promise.all([
      signedInLearner(),
      userFixture(),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    const { lesson: hidden } = await playableLessonFixture({
      lesson: { ownerId: owner.id, visibility: "private" },
      steps: ["check"],
    });

    const results = await Promise.all(
      [unwritten.id, hidden.id].map((lessonId) =>
        saveLesson({ goalId: goal.id, lessonId, saved: true }),
      ),
    );

    expect(results).toStrictEqual([{ status: "notFound" }, { status: "notFound" }]);

    await expect(prisma.savedLesson.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("hides another learner's goal for listing and for both write states", async () => {
    const [{ goal }, stranger] = await Promise.all([signedInLearner(), userFixture()]);
    mockSession(stranger.id);
    const input = { goalId: goal.id, lessonId: randomUUID() };

    await expect(listCurrentUserSavedLessons({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(
      Promise.all([saveLesson({ ...input, saved: true }), saveLesson({ ...input, saved: false })]),
    ).resolves.toStrictEqual([{ status: "notFound" }, { status: "notFound" }]);
  });

  it("lists saves from the goal or in its plan, newest first, with current titles", async () => {
    const [{ goal, user }, chapter] = await Promise.all([
      signedInLearner(),
      libraryChapterFixture({ title: "Waves" }),
    ]);

    const [otherGoal, { lesson: planned }, { lesson: direct }, { lesson: unrelated }] =
      await Promise.all([
        goalFixture({ userId: user.id }),
        playableLessonFixture({ lesson: { homeChapterId: chapter.id }, steps: ["check"] }),
        playableLessonFixture({ steps: ["check"] }),
        playableLessonFixture({ steps: ["check"] }),
      ]);

    await planFixture({ goalId: goal.id, items: [{ lessonId: planned.id }] });

    await prisma.savedLesson.createMany({
      data: [
        { createdAt: new Date("2026-10-20"), goalId: otherGoal.id, lessonId: planned.id },
        { createdAt: new Date("2026-10-21"), goalId: goal.id, lessonId: direct.id },
        { createdAt: new Date("2026-10-22"), goalId: otherGoal.id, lessonId: unrelated.id },
      ].map((row) => ({ ...row, title: "Title at save", userId: user.id })),
    });

    await expect(listCurrentUserSavedLessons({ goalId: goal.id })).resolves.toStrictEqual({
      lessons: [
        { available: true, chapterTitle: null, lessonId: direct.id, title: direct.title },
        { available: true, chapterTitle: "Waves", lessonId: planned.id, title: planned.title },
      ],
      status: "ready",
    });
  });

  it("retains the snapshot for a removed lesson and clears the place on the last removal", async () => {
    const [{ goal, user }, { lesson }, stranger] = await Promise.all([
      signedInLearner(),
      playableLessonFixture({ lesson: { title: "Title at save" }, steps: ["check"] }),
      userFixture(),
    ]);

    const input = { goalId: goal.id, lessonId: lesson.id };

    await expect(getLearnerSummary()).resolves.toMatchObject({ places: { savedLessons: false } });
    await saveLesson({ ...input, saved: true });
    await expect(getLearnerSummary()).resolves.toMatchObject({ places: { savedLessons: true } });

    await Promise.all([
      prisma.savedLesson.create({ data: { ...input, title: "Another save", userId: stranger.id } }),
      prisma.lesson.delete({ where: { id: lesson.id } }),
    ]);

    await expect(listCurrentUserSavedLessons({ goalId: goal.id })).resolves.toStrictEqual({
      lessons: [
        { available: false, chapterTitle: null, lessonId: lesson.id, title: "Title at save" },
      ],
      status: "ready",
    });

    await expect(saveLesson({ ...input, saved: false })).resolves.toStrictEqual({
      saved: false,
      status: "ready",
    });

    await expect(
      prisma.savedLesson.findMany({ where: { lessonId: lesson.id } }),
    ).resolves.toStrictEqual([expect.objectContaining({ userId: stranger.id })]);

    await expect(prisma.savedLesson.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(getLearnerSummary()).resolves.toMatchObject({ places: { savedLessons: false } });
  });
});
