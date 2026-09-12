import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { listCurrentUserContinueLearningItems } from "../courses/list-current-user-continue-learning-items";
import { getNextLessonAfter } from "../lessons/get-next-lesson-in-course";
import { getNextPreloadTargetResource } from "../player/commands/get-next-lesson-preload-target";
import { getCourseContinueProgress } from "./get-continue-progress";
import { getCourseProgressResource } from "./get-course-progress";
import { getNextLesson } from "./get-next-lesson";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

async function createPath() {
  const [organization, user] = await Promise.all([
    organizationFixture({ kind: "brand" }),
    userFixture(),
  ]);

  const course = await courseFixture({
    curriculumVersion: 2,
    isPublished: true,
    organizationId: organization.id,
  });

  const common = { courseId: course.id, isPublished: true, organizationId: organization.id };

  const [earlier, selected, pending] = await Promise.all([
    chapterFixture({ ...common, level: "basic", position: 0 }),
    chapterFixture({ ...common, level: "intermediate", position: 1 }),
    chapterFixture({ ...common, generationStatus: "pending", level: "advanced", position: 2 }),
  ]);

  const lesson = { isPublished: true, organizationId: organization.id };

  const [previous, current, optional, next] = await Promise.all([
    lessonFixture({ ...lesson, chapterId: earlier.id, position: 0 }),
    lessonFixture({ ...lesson, chapterId: selected.id, position: 0 }),
    lessonFixture({ ...lesson, chapterId: selected.id, kind: "quiz", position: 1 }),
    lessonFixture({ ...lesson, chapterId: selected.id, generationStatus: "pending", position: 2 }),
  ]);

  await prisma.courseLearningPlan.create({
    data: {
      chapterIds: [selected.id, pending.id],
      contentRevision: course.contentRevision,
      courseId: course.id,
      startingLevel: "intermediate",
      userId: user.id,
    },
  });

  mockSession(user.id);
  return { course, current, earlier, next, optional, pending, previous, selected, user };
}

describe("saved learning path consumers", () => {
  it("keeps a guest's full-subject lesson in its level path instead of returning to the default overview", async () => {
    const { course, current, earlier, previous } = await createPath();

    const overview = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      level: "overview",
      organizationId: course.organizationId,
      position: 3,
    });

    const [sameChapter] = await Promise.all([
      lessonFixture({
        chapterId: earlier.id,
        isPublished: true,
        organizationId: course.organizationId,
        position: 1,
      }),
      lessonFixture({
        chapterId: overview.id,
        isPublished: true,
        organizationId: course.organizationId,
      }),
    ]);

    mockSession(null);

    await expect(getNextLessonAfter({ lessonId: previous.id })).resolves.toMatchObject({
      lesson: { lessonId: sameChapter.id },
      status: "ready",
    });

    await expect(getNextLessonAfter({ lessonId: sameChapter.id })).resolves.toMatchObject({
      lesson: { lessonId: current.id },
      status: "ready",
    });
  });

  it("keeps a guest in the overview they opened and stops at its final lesson", async () => {
    const { course, earlier, previous } = await createPath();
    await prisma.chapter.update({ data: { level: "overview" }, where: { id: earlier.id } });

    const nextOverview = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      level: "overview",
      organizationId: course.organizationId,
      position: 3,
    });

    const [sameChapter, last] = await Promise.all([
      lessonFixture({
        chapterId: earlier.id,
        isPublished: true,
        organizationId: course.organizationId,
        position: 1,
      }),
      lessonFixture({
        chapterId: nextOverview.id,
        isPublished: true,
        organizationId: course.organizationId,
      }),
    ]);

    mockSession(null);

    await expect(getNextLessonAfter({ lessonId: previous.id })).resolves.toMatchObject({
      lesson: { lessonId: sameChapter.id },
      status: "ready",
    });

    await expect(getNextLessonAfter({ lessonId: sameChapter.id })).resolves.toMatchObject({
      lesson: { lessonId: last.id },
      status: "ready",
    });

    await expect(getNextLessonAfter({ lessonId: last.id })).resolves.toMatchObject({
      lesson: null,
      status: "ready",
    });
  });

  it("continues an explicitly opened chapter outside a saved path without changing that path", async () => {
    const { course, current, earlier, pending, previous, selected, user } = await createPath();

    const sameChapter = await lessonFixture({
      chapterId: earlier.id,
      isPublished: true,
      organizationId: course.organizationId,
      position: 1,
    });

    await expect(getNextLessonAfter({ lessonId: previous.id })).resolves.toMatchObject({
      lesson: { lessonId: sameChapter.id },
      status: "ready",
    });

    await expect(getNextLessonAfter({ lessonId: sameChapter.id })).resolves.toMatchObject({
      lesson: { lessonId: current.id },
      status: "ready",
    });

    await expect(
      prisma.courseLearningPlan.findUnique({
        where: { userCoursePlan: { courseId: course.id, userId: user.id } },
      }),
    ).resolves.toMatchObject({ chapterIds: [selected.id, pending.id] });
  });

  it("browses complete curriculum order without changing the learner's selected path", async () => {
    const { course, current, next, previous, selected, user } = await createPath();

    await prisma.courseLearningPlan.update({
      data: { chapterIds: [selected.id] },
      where: { userCoursePlan: { courseId: course.id, userId: user.id } },
    });

    await expect(
      getNextLessonAfter({ lessonId: previous.id, view: "curriculum" }),
    ).resolves.toMatchObject({ lesson: { lessonId: current.id }, status: "ready" });

    await expect(
      getNextLessonAfter({ lessonId: current.id, view: "curriculum" }),
    ).resolves.toMatchObject({ lesson: { lessonId: next.id }, status: "ready" });

    await expect(
      prisma.courseLearningPlan.findUnique({
        where: { userCoursePlan: { courseId: course.id, userId: user.id } },
      }),
    ).resolves.toMatchObject({ chapterIds: [selected.id] });
  });

  it("continues from the teaching source after an appended optional activity", async () => {
    const { current, next, optional } = await createPath();

    await prisma.lesson.update({
      data: { position: 10, sourceLessonId: current.id },
      where: { id: optional.id },
    });

    await expect(getNextLessonAfter({ lessonId: optional.id })).resolves.toMatchObject({
      lesson: { lessonId: next.id },
      status: "ready",
    });
  });

  it("does not choose or preload a default path while a focused plan needs reselection", async () => {
    const { course, current, selected, user } = await createPath();

    await prisma.courseLearningPlan.update({
      data: {
        contentRevision: course.contentRevision + 1,
        depth: "focused",
        goal: "Build a small website",
      },
      where: { userCoursePlan: { courseId: course.id, userId: user.id } },
    });

    await prisma.chapterGenerationGrant.create({
      data: { chapterId: selected.id, userId: user.id },
    });

    await expect(getNextLesson({ scope: { courseId: course.id } })).resolves.toBeNull();

    await expect(getNextLessonAfter({ lessonId: current.id })).resolves.toMatchObject({
      lesson: null,
      status: "ready",
    });

    await expect(listCurrentUserContinueLearningItems()).resolves.toStrictEqual([]);

    await expect(getNextPreloadTargetResource({ lessonId: current.id })).resolves.toStrictEqual({
      status: "ready",
      targets: [],
    });
  });

  it("starts at the saved level and skips optional activities in structural continuation", async () => {
    const { course, current, next } = await createPath();

    await expect(getNextLesson({ scope: { courseId: course.id } })).resolves.toMatchObject({
      lessonId: current.id,
    });

    await expect(getNextLessonAfter({ lessonId: current.id })).resolves.toMatchObject({
      lesson: { lessonId: next.id },
      status: "ready",
    });
  });

  it("keeps partial selected progress and pending chapter totals honest", async () => {
    const { course, current, earlier, pending, previous, selected, user } = await createPath();

    await Promise.all(
      [current, previous].map((lesson) =>
        lessonProgressFixture({
          completedAt: new Date(),
          durationSeconds: 60,
          lessonId: lesson.id,
          userId: user.id,
        }),
      ),
    );

    await expect(getCourseProgressResource({ courseId: course.id })).resolves.toStrictEqual({
      chapters: [
        { chapterId: selected.id, completedLessons: 1, totalLessons: 2 },
        { chapterId: pending.id, completedLessons: 0, totalLessons: 0 },
      ],
      percentComplete: null,
    });

    await expect(getCourseContinueProgress({ courseId: course.id })).resolves.toBeNull();

    await expect(
      getCourseProgressResource({ courseId: course.id, view: "curriculum" }),
    ).resolves.toStrictEqual({
      chapters: [
        { chapterId: earlier.id, completedLessons: 1, totalLessons: 1 },
        { chapterId: selected.id, completedLessons: 1, totalLessons: 2 },
        { chapterId: pending.id, completedLessons: 0, totalLessons: 0 },
      ],
      percentComplete: null,
    });
  });

  it("keeps an expanded path visible despite an older durable course badge", async () => {
    const { course, current, next, user } = await createPath();

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: current.id,
        userId: user.id,
      }),
      prisma.courseCompletion.create({ data: { courseId: course.id, userId: user.id } }),
    ]);

    await expect(listCurrentUserContinueLearningItems()).resolves.toMatchObject([
      { course: { id: course.id }, lesson: { id: next.id }, status: "pending" },
    ]);
  });

  it("can resume a saved path before its first completion", async () => {
    const { course, current } = await createPath();

    await expect(listCurrentUserContinueLearningItems()).resolves.toMatchObject([
      { course: { id: course.id }, lesson: { id: current.id }, status: "ready" },
    ]);
  });

  it("preloads only required lessons in a chapter the learner already funded", async () => {
    const { current, next, pending, selected, user } = await createPath();

    await expect(getNextPreloadTargetResource({ lessonId: current.id })).resolves.toStrictEqual({
      status: "ready",
      targets: [],
    });

    await prisma.chapterGenerationGrant.create({
      data: { chapterId: selected.id, userId: user.id },
    });

    await expect(getNextPreloadTargetResource({ lessonId: current.id })).resolves.toStrictEqual({
      status: "ready",
      targets: [{ kind: "lesson", lessonId: next.id }],
    });

    await expect(
      prisma.chapterGenerationGrant.count({ where: { chapterId: pending.id, userId: user.id } }),
    ).resolves.toBe(0);
  });

  it("keeps private continuation and progress owner-scoped, including historical anchors", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const course = await courseFixture({
      curriculumVersion: 2,
      format: "personalized",
      isPublished: true,
      userId: owner.id,
    });

    const chapter = await chapterFixture({ courseId: course.id, isPublished: true });
    const lesson = await lessonFixture({ chapterId: chapter.id, isPublished: true });

    mockSession(owner.id);

    await expect(getNextLesson({ scope: { courseId: course.id } })).resolves.toMatchObject({
      brandSlug: "me",
      lessonId: lesson.id,
    });

    await expect(
      getCourseProgressResource({ courseId: course.id, view: "curriculum" }),
    ).resolves.toMatchObject({ chapters: [{ chapterId: chapter.id, totalLessons: 1 }] });

    // A historical row must not expose a course that is now private to another learner.
    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: other.id,
    });

    mockSession(other.id);
    await expect(getNextLesson({ scope: { courseId: course.id } })).resolves.toBeNull();

    await expect(getNextLessonAfter({ lessonId: lesson.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(
      getCourseProgressResource({ courseId: course.id, view: "curriculum" }),
    ).resolves.toBeNull();

    await expect(listCurrentUserContinueLearningItems()).resolves.toStrictEqual([]);
  });
});
