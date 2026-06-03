import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { listUserCourses } from "./list-user-courses";

/**
 * My Courses is backed by completed lesson progress, so tests create the
 * smallest real course tree that can prove whether a course belongs in that
 * list instead of relying on the CourseUser row alone.
 */
async function createCourseWithLesson({
  organizationId,
  userId,
}: {
  organizationId: string | null;
  userId?: string;
}) {
  const course = await courseFixture({ isPublished: true, organizationId, userId });
  const chapter = await chapterFixture({ courseId: course.id, isPublished: true, organizationId });
  const lesson = await lessonFixture({ chapterId: chapter.id, isPublished: true, organizationId });

  return { course, lesson };
}

/**
 * A course only belongs in My Courses after a learner finishes a lesson, so
 * tests call this helper whenever they need a course to satisfy that contract.
 */
async function completeLessonForUser({ lessonId, userId }: { lessonId: string; userId: string }) {
  return lessonProgressFixture({ completedAt: new Date(), durationSeconds: 60, lessonId, userId });
}

describe("unauthenticated users", () => {
  it("returns Unauthorized", async () => {
    const result = await listUserCourses(new Headers());

    expect(result.error?.message).toBe(ErrorCode.unauthorized);
    expect(result.data).toBeNull();
  });
});

describe("authenticated users", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;
  let user: Awaited<ReturnType<typeof userFixture>>;
  let headers: Headers;

  beforeAll(async () => {
    [organization, user] = await Promise.all([organizationFixture(), userFixture()]);

    headers = await signInAs(user.email, user.password);
  });

  it("returns empty array when user has no courses", async () => {
    const newUser = await userFixture();
    const newHeaders = await signInAs(newUser.email, newUser.password);

    const result = await listUserCourses(newHeaders);

    expect(result.error).toBeNull();
    expect(result.data).toStrictEqual([]);
  });

  it("returns courses where the user completed a lesson", async () => {
    const { course, lesson } = await createCourseWithLesson({ organizationId: organization.id });

    await Promise.all([
      courseUserFixture({ courseId: course.id, userId: user.id }),
      completeLessonForUser({ lessonId: lesson.id, userId: user.id }),
    ]);

    const result = await listUserCourses(headers);

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.some((item) => item.id === course.id)).toBe(true);
  });

  it("excludes courses where the user started but did not complete a lesson", async () => {
    const testUser = await userFixture();
    const testHeaders = await signInAs(testUser.email, testUser.password);
    const { course, lesson } = await createCourseWithLesson({ organizationId: organization.id });

    await Promise.all([
      courseUserFixture({ courseId: course.id, userId: testUser.id }),
      lessonProgressFixture({
        completedAt: null,
        durationSeconds: null,
        lessonId: lesson.id,
        userId: testUser.id,
      }),
    ]);

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data?.some((item) => item.id === course.id)).toBe(false);
  });

  it("includes the organization in the response", async () => {
    const testUser = await userFixture();
    const testHeaders = await signInAs(testUser.email, testUser.password);

    const { course, lesson } = await createCourseWithLesson({ organizationId: organization.id });

    await Promise.all([
      courseUserFixture({ courseId: course.id, userId: testUser.id }),
      completeLessonForUser({ lessonId: lesson.id, userId: testUser.id }),
    ]);

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();

    const returnedCourse = result.data?.find((item) => item.id === course.id);
    expect(returnedCourse?.organization).toBeDefined();
    expect(returnedCourse?.organization?.id).toBe(organization.id);
    expect(returnedCourse?.organization?.slug).toBe(organization.slug);
  });

  it("orders courses by startedAt descending (most recent first)", async () => {
    const testUser = await userFixture();
    const testHeaders = await signInAs(testUser.email, testUser.password);

    const [data1, data2, data3] = await Promise.all([
      createCourseWithLesson({ organizationId: organization.id }),
      createCourseWithLesson({ organizationId: organization.id }),
      createCourseWithLesson({ organizationId: organization.id }),
    ]);

    const [course1, course2, course3] = [data1.course, data2.course, data3.course];

    // Create course users with specific timestamps
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    await prisma.courseUser.createMany({
      data: [
        { courseId: course1.id, startedAt: twoHoursAgo, userId: testUser.id },
        { courseId: course2.id, startedAt: now, userId: testUser.id },
        { courseId: course3.id, startedAt: oneHourAgo, userId: testUser.id },
      ],
    });

    await Promise.all(
      [data1, data2, data3].map((data) =>
        completeLessonForUser({ lessonId: data.lesson.id, userId: testUser.id }),
      ),
    );

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(3);

    const courseIds = result.data?.map((item) => item.id);
    expect(courseIds).toStrictEqual([course2.id, course3.id, course1.id]);
  });

  it("excludes courses from non-brand organizations", async () => {
    const testUser = await userFixture();
    const testHeaders = await signInAs(testUser.email, testUser.password);

    const [brandOrg, schoolOrg] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    const [brandData, schoolData] = await Promise.all([
      createCourseWithLesson({ organizationId: brandOrg.id }),
      createCourseWithLesson({ organizationId: schoolOrg.id }),
    ]);

    const [brandCourse, schoolCourse] = [brandData.course, schoolData.course];

    await Promise.all([
      courseUserFixture({ courseId: brandCourse.id, userId: testUser.id }),
      courseUserFixture({ courseId: schoolCourse.id, userId: testUser.id }),
      completeLessonForUser({ lessonId: brandData.lesson.id, userId: testUser.id }),
      completeLessonForUser({ lessonId: schoolData.lesson.id, userId: testUser.id }),
    ]);

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data?.some((item) => item.id === brandCourse.id)).toBe(true);
    expect(result.data?.some((item) => item.id === schoolCourse.id)).toBe(false);
  });

  it("includes personal courses with null organization", async () => {
    const testUser = await userFixture();
    const testHeaders = await signInAs(testUser.email, testUser.password);

    const { course: personalCourse, lesson } = await createCourseWithLesson({
      organizationId: null,
      userId: testUser.id,
    });

    await Promise.all([
      courseUserFixture({ courseId: personalCourse.id, userId: testUser.id }),
      completeLessonForUser({ lessonId: lesson.id, userId: testUser.id }),
    ]);

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data?.some((item) => item.id === personalCourse.id)).toBe(true);
  });

  it("does not return other users courses", async () => {
    const [otherUser, testUser] = await Promise.all([userFixture(), userFixture()]);

    const testHeaders = await signInAs(testUser.email, testUser.password);

    const [otherUserData, testUserData] = await Promise.all([
      createCourseWithLesson({ organizationId: organization.id }),
      createCourseWithLesson({ organizationId: organization.id }),
    ]);

    const [otherUserCourse, testUserCourse] = [otherUserData.course, testUserData.course];

    await Promise.all([
      courseUserFixture({ courseId: otherUserCourse.id, userId: otherUser.id }),
      courseUserFixture({ courseId: testUserCourse.id, userId: testUser.id }),
      completeLessonForUser({ lessonId: otherUserData.lesson.id, userId: otherUser.id }),
      completeLessonForUser({ lessonId: testUserData.lesson.id, userId: testUser.id }),
    ]);

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data?.some((item) => item.id === testUserCourse.id)).toBe(true);
    expect(result.data?.some((item) => item.id === otherUserCourse.id)).toBe(false);
  });
});
