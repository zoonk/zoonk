import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag, getUserProgressCacheTag } from "../cache/tags";
import { removeCurrentUserCourse } from "./remove-current-user-course";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe(removeCurrentUserCourse, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession(null);
  });

  it("does not remove course membership for a guest", async () => {
    const [course, user] = await Promise.all([courseFixture(), userFixture()]);
    await courseUserFixture({ courseId: course.id, userId: user.id });

    await expect(removeCurrentUserCourse({ courseId: course.id })).resolves.toBeNull();

    await expect(
      prisma.courseUser.findUnique({
        where: { courseUser: { courseId: course.id, userId: user.id } },
      }),
    ).resolves.not.toBeNull();
  });

  it("removes only library membership while preserving learning progress", async () => {
    const [course, otherUser, user] = await Promise.all([
      courseFixture(),
      userFixture(),
      userFixture(),
    ]);

    const chapter = await chapterFixture({ courseId: course.id });
    const lesson = await lessonFixture({ chapterId: chapter.id });

    const [lessonProgress] = await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 90,
        lessonId: lesson.id,
        userId: user.id,
      }),
      courseUserFixture({ courseId: course.id, userId: otherUser.id }),
      courseUserFixture({ courseId: course.id, userId: user.id }),
    ]);

    mockSession(user.id);

    await expect(removeCurrentUserCourse({ courseId: course.id })).resolves.toStrictEqual({
      removed: true,
    });

    const [courseUser, otherCourseUser, preservedProgress, updatedCourse] = await Promise.all([
      prisma.courseUser.findUnique({
        where: { courseUser: { courseId: course.id, userId: user.id } },
      }),
      prisma.courseUser.findUnique({
        where: { courseUser: { courseId: course.id, userId: otherUser.id } },
      }),
      prisma.lessonProgress.findUnique({ where: { id: lessonProgress.id } }),
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ]);

    expect(courseUser).toBeNull();
    expect(otherCourseUser).not.toBeNull();
    expect(preservedProgress).not.toBeNull();
    expect(updatedCourse.userCount).toBe(1);
    expect(revalidateTag).toHaveBeenCalledWith(COURSE_LIST_CACHE_TAG, { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith(getCourseCacheTag(course.id), { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith(getUserProgressCacheTag(user.id), { expire: 0 });
  });

  it("does not change the course when the learner is not enrolled", async () => {
    const [course, user] = await Promise.all([courseFixture(), userFixture()]);
    mockSession(user.id);

    await expect(removeCurrentUserCourse({ courseId: course.id })).resolves.toStrictEqual({
      removed: false,
    });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ userCount: 0 });

    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
