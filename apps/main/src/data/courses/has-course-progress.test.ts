import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { hasCourseProgress } from "./has-course-progress";

/**
 * Course progress mode depends on a course enrollment row, but the regression
 * case still needs a real published lesson so the old lesson-progress lookup
 * would see the row and fail the test before the implementation is simplified.
 */
async function createPublishedCourseWithLesson() {
  const course = await courseFixture({ isPublished: true });
  const chapter = await chapterFixture({ courseId: course.id, isPublished: true });
  const lesson = await lessonFixture({ chapterId: chapter.id, isPublished: true });

  return { course, lesson };
}

describe(hasCourseProgress, () => {
  it("returns false for unauthenticated users", async () => {
    const course = await courseFixture({ isPublished: true });

    const result = await hasCourseProgress({ courseId: course.id, headers: new Headers() });

    expect(result).toBe(false);
  });

  it("returns false when the user is not enrolled in the course", async () => {
    const [user, course] = await Promise.all([userFixture(), courseFixture({ isPublished: true })]);

    const headers = await signInAs(user.email, user.password);

    const result = await hasCourseProgress({ courseId: course.id, headers });

    expect(result).toBe(false);
  });

  it("returns true when the user is enrolled in the course", async () => {
    const [user, course] = await Promise.all([userFixture(), courseFixture({ isPublished: true })]);

    const headers = await signInAs(user.email, user.password);

    await courseUserFixture({ courseId: course.id, userId: user.id });

    const result = await hasCourseProgress({ courseId: course.id, headers });

    expect(result).toBe(true);
  });

  it("returns false when the user only has lesson progress in the course", async () => {
    const [user, courseData] = await Promise.all([
      userFixture(),
      createPublishedCourseWithLesson(),
    ]);

    const headers = await signInAs(user.email, user.password);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: courseData.lesson.id,
      userId: user.id,
    });

    const result = await hasCourseProgress({ courseId: courseData.course.id, headers });

    expect(result).toBe(false);
  });
});
