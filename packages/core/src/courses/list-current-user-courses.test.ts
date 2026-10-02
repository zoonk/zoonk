import { randomUUID } from "node:crypto";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { listCurrentUserCourses, listCurrentUserCoursesPage } from "./list-current-user-courses";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

const HOUR_MS = 3_600_000;

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * HOUR_MS);
}

type CourseAttrs = NonNullable<Parameters<typeof courseFixture>[0]>;

/** A course with one chapter written for it; a published brand course unless attrs say otherwise. */
async function courseWithChapterFixture(attrs: CourseAttrs = {}) {
  const organization = await organizationFixture({ kind: "brand" });

  const course = await courseFixture({
    isPublished: true,
    organizationId: organization.id,
    ...attrs,
  });

  const chapter = await libraryChapterFixture({ homeCourseId: course.id });
  return { chapter, course };
}

/** A lesson the learner started in a chapter, as the lesson player records it in the ledger. */
function startedLessonFixture({
  chapterId,
  startedAt,
  userId,
}: {
  chapterId: string;
  startedAt: Date;
  userId: string;
}) {
  return learningEventFixture({
    contentIds: { chapterId, lessonId: randomUUID() },
    endedAt: startedAt,
    seconds: 0,
    userId,
  });
}

describe(listCurrentUserCourses, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns an empty list without a session", async () => {
    await expect(listCurrentUserCourses()).resolves.toStrictEqual([]);
  });

  it("lists goal courses and courses of started lessons, most recent activity first", async () => {
    const [learner, goalCourse, startedCourse, latestCourse] = await Promise.all([
      userFixture(),
      courseWithChapterFixture(),
      courseWithChapterFixture(),
      courseWithChapterFixture(),
    ]);

    await Promise.all([
      goalFixture({
        primaryCourseId: goalCourse.course.id,
        status: "archived",
        updatedAt: hoursAgo(3),
        userId: learner.id,
      }),
      startedLessonFixture({
        chapterId: startedCourse.chapter.id,
        startedAt: hoursAgo(5),
        userId: learner.id,
      }),
      startedLessonFixture({
        chapterId: startedCourse.chapter.id,
        startedAt: hoursAgo(2),
        userId: learner.id,
      }),
      startedLessonFixture({
        chapterId: latestCourse.chapter.id,
        startedAt: hoursAgo(1),
        userId: learner.id,
      }),
    ]);

    mockSession(learner.id);

    const courses = await listCurrentUserCourses();

    expect(courses.map((course) => course.id)).toStrictEqual([
      latestCourse.course.id,
      startedCourse.course.id,
      goalCourse.course.id,
    ]);

    expect(courses[0]?.organization?.kind).toBe("brand");
  });

  it("lists the learner's own private courses but no one else's, nor unpublished ones", async () => {
    const [learner, other] = await Promise.all([userFixture(), userFixture()]);

    const [ownCourse, othersCourse, unpublished] = await Promise.all([
      courseFixture({ userId: learner.id, visibility: "private" }),
      courseFixture({ userId: other.id, visibility: "private" }),
      courseWithChapterFixture({ isPublished: false }),
    ]);

    const othersChapter = await libraryChapterFixture({ homeCourseId: othersCourse.id });

    await Promise.all([
      goalFixture({ primaryCourseId: ownCourse.id, userId: learner.id }),
      goalFixture({ primaryCourseId: othersCourse.id, userId: other.id }),
      startedLessonFixture({
        chapterId: othersChapter.id,
        startedAt: hoursAgo(1),
        userId: learner.id,
      }),
      startedLessonFixture({
        chapterId: unpublished.chapter.id,
        startedAt: hoursAgo(1),
        userId: learner.id,
      }),
      startedLessonFixture({ chapterId: randomUUID(), startedAt: hoursAgo(1), userId: learner.id }),
    ]);

    mockSession(learner.id);

    const courses = await listCurrentUserCourses();

    expect(
      courses.map((course) => ({ id: course.id, organization: course.organization })),
    ).toStrictEqual([{ id: ownCourse.id, organization: null }]);
  });
});

describe(listCurrentUserCoursesPage, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns null without a session", async () => {
    await expect(listCurrentUserCoursesPage({ limit: 10 })).resolves.toBeNull();
  });

  it("filters by title or description before paginating", async () => {
    const [learner, titleMatch, descriptionMatch, unrelated] = await Promise.all([
      userFixture(),
      courseWithChapterFixture({ title: "Ocean habitats" }),
      courseWithChapterFixture({ description: "Explore ocean ecosystems", title: "Marine life" }),
      courseWithChapterFixture({ description: "Numbers", title: "Math" }),
    ]);

    await Promise.all(
      [titleMatch, descriptionMatch, unrelated].map(({ course }, index) =>
        goalFixture({ primaryCourseId: course.id, updatedAt: hoursAgo(index), userId: learner.id }),
      ),
    );

    mockSession(learner.id);

    const [firstPage, secondPage, allCourses] = await Promise.all([
      listCurrentUserCoursesPage({ limit: 1, query: "  OCEAN " }),
      listCurrentUserCoursesPage({ limit: 1, offset: 1, query: "ocean" }),
      listCurrentUserCoursesPage({ limit: 10 }),
    ]);

    expect(firstPage).toMatchObject({ courses: [{ id: titleMatch.course.id }], hasMore: true });

    expect(secondPage).toMatchObject({
      courses: [{ id: descriptionMatch.course.id }],
      hasMore: false,
    });

    expect(allCourses?.courses).toHaveLength(3);
  });
});
