import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { beforeEach, describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getCatalogCourseNextLesson } from "../next-lesson";
import { getCatalogCourseProgress } from "../progress";
import { listFinishedLessonIds, loadViewerFinishedLessons } from "./finished-lessons";

describe("bounded catalog completion ledger", () => {
  beforeEach(() => mockSession(null));

  it("returns only the requested course's completions despite unrelated lifetime history", async () => {
    const [learner, other, catalog, unrelated] = await Promise.all([
      userFixture(),
      userFixture(),
      catalogCourseFixture({ lessonCounts: [3] }),
      catalogCourseFixture({ lessonCounts: [20] }),
    ]);

    const [first, replay, unfinished] = catalog.lessons.flat();
    const lessonIds = catalog.lessons.flat().map((lesson) => lesson.id);

    const seed = await learningEventFixture({
      contentIds: { lessonId: first!.id },
      userId: learner.id,
    });

    const { id: _id, ...event } = seed;

    await prisma.learningEvent.createMany({
      data: [
        ...unrelated.lessons
          .flat()
          .map((lesson) => ({ ...event, contentIds: { lessonId: lesson.id } })),
        ...Array.from({ length: 1000 }, () => ({
          ...event,
          contentIds: { lessonId: randomUUID() },
        })),
        { ...event, contentIds: { lessonId: replay!.id }, kind: "review" },
        { ...event, contentIds: { lessonId: replay!.id }, kind: "review" },
        { ...event, contentIds: { lessonId: unfinished!.id }, endedAt: null },
        { ...event, contentIds: { lessonId: unfinished!.id }, kind: "questions" },
        { ...event, contentIds: { lessonId: unfinished!.id }, userId: other.id },
      ],
    });

    mockSession(learner.id);

    const lifetime = await listFinishedLessonIds(learner.id);
    expect(lifetime.size).toBe(1022);

    const counts = await countDatabaseStatements(() => loadViewerFinishedLessons(lessonIds));
    assertReadBudget(counts, 1);

    expect(counts.result).toStrictEqual({
      finishedLessonIds: new Set([...lifetime].filter((id) => lessonIds.includes(id))),
      signedIn: true,
    });

    expect(counts.result.finishedLessonIds.size).toBe(2);

    await expect(getCatalogCourseProgress({ courseId: catalog.course.id })).resolves.toStrictEqual({
      chapters: [{ chapterId: catalog.chapters[0]!.id, completedLessons: 2, totalLessons: 3 }],
      percentComplete: 67,
    });

    await expect(
      getCatalogCourseNextLesson({ courseId: catalog.course.id }),
    ).resolves.toMatchObject({
      status: "ready",
      target: { hasStarted: true, lessonId: unfinished!.id },
    });
  });

  it("keeps completion after content deletion, including a replay with extra snapshot ids", async () => {
    const [learner, catalog] = await Promise.all([
      userFixture(),
      catalogCourseFixture({ lessonCounts: [1] }),
    ]);

    const lessonId = catalog.lessons.flat()[0]!.id;

    await learningEventFixture({
      contentIds: { chapterId: catalog.chapters[0]!.id, lessonId },
      kind: "review",
      userId: learner.id,
    });

    await prisma.lesson.delete({ where: { id: lessonId } });
    mockSession(learner.id);

    await expect(loadViewerFinishedLessons([lessonId, lessonId])).resolves.toStrictEqual({
      finishedLessonIds: new Set([lessonId]),
      signedIn: true,
    });
  });

  it("does not query the ledger for an empty outline or an unauthenticated viewer", async () => {
    const learner = await userFixture();
    mockSession(learner.id);
    const empty = await countDatabaseStatements(() => loadViewerFinishedLessons([]));
    assertReadBudget(empty, 0);
    expect(empty.result).toStrictEqual({ finishedLessonIds: new Set(), signedIn: true });

    mockSession(null);
    const visitor = await countDatabaseStatements(() => loadViewerFinishedLessons([randomUUID()]));
    assertReadBudget(visitor, 0);
    expect(visitor.result).toStrictEqual({ finishedLessonIds: new Set(), signedIn: false });
  });
});
