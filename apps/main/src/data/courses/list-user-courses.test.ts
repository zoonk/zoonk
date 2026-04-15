import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { listUserCourses } from "./list-user-courses";

describe("unauthenticated users", () => {
  test("returns Unauthorized", async () => {
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

  test("returns empty array when user has no courses", async () => {
    const newUser = await userFixture();
    const newHeaders = await signInAs(newUser.email, newUser.password);

    const result = await listUserCourses(newHeaders);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns courses the user has started", async () => {
    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    await courseUserFixture({
      courseId: course.id,
      userId: user.id,
    });

    const result = await listUserCourses(headers);

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.some((item) => item.id === course.id)).toBe(true);
  });

  test("includes the organization in the response", async () => {
    const testUser = await userFixture();
    const testHeaders = await signInAs(testUser.email, testUser.password);

    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    await courseUserFixture({
      courseId: course.id,
      userId: testUser.id,
    });

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();

    const returnedCourse = result.data?.find((item) => item.id === course.id);
    expect(returnedCourse?.organization).toBeDefined();
    expect(returnedCourse?.organization?.id).toBe(organization.id);
    expect(returnedCourse?.organization?.slug).toBe(organization.slug);
  });

  test("orders courses by startedAt descending (most recent first)", async () => {
    const testUser = await userFixture();
    const testHeaders = await signInAs(testUser.email, testUser.password);

    const [course1, course2, course3] = await Promise.all([
      courseFixture({ isPublished: true, organizationId: organization.id }),
      courseFixture({ isPublished: true, organizationId: organization.id }),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    // Create course users with specific timestamps
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    await prisma.courseUser.createMany({
      data: [
        {
          courseId: course1.id,
          startedAt: twoHoursAgo,
          userId: testUser.id,
        },
        {
          courseId: course2.id,
          startedAt: now,
          userId: testUser.id,
        },
        {
          courseId: course3.id,
          startedAt: oneHourAgo,
          userId: testUser.id,
        },
      ],
    });

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(3);

    const courseIds = result.data?.map((item) => item.id);
    expect(courseIds).toEqual([course2.id, course3.id, course1.id]);
  });

  test("excludes courses from non-brand organizations", async () => {
    const testUser = await userFixture();
    const testHeaders = await signInAs(testUser.email, testUser.password);

    const [brandOrg, schoolOrg] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    const [brandCourse, schoolCourse] = await Promise.all([
      courseFixture({ isPublished: true, organizationId: brandOrg.id }),
      courseFixture({ isPublished: true, organizationId: schoolOrg.id }),
    ]);

    await Promise.all([
      courseUserFixture({ courseId: brandCourse.id, userId: testUser.id }),
      courseUserFixture({ courseId: schoolCourse.id, userId: testUser.id }),
    ]);

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data?.some((item) => item.id === brandCourse.id)).toBe(true);
    expect(result.data?.some((item) => item.id === schoolCourse.id)).toBe(false);
  });

  test("includes personal courses with null organization", async () => {
    const testUser = await userFixture();
    const testHeaders = await signInAs(testUser.email, testUser.password);

    const personalCourse = await courseFixture({
      isPublished: true,
      organizationId: null,
      userId: testUser.id,
    });

    await courseUserFixture({
      courseId: personalCourse.id,
      userId: testUser.id,
    });

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data?.some((item) => item.id === personalCourse.id)).toBe(true);
  });

  test("excludes archived courses", async () => {
    const testUser = await userFixture();
    const testHeaders = await signInAs(testUser.email, testUser.password);

    const archivedCourse = await courseFixture({
      archivedAt: new Date(),
      isPublished: true,
      organizationId: organization.id,
    });

    await courseUserFixture({
      courseId: archivedCourse.id,
      userId: testUser.id,
    });

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data?.some((item) => item.id === archivedCourse.id)).toBe(false);
  });

  test("does not return other users courses", async () => {
    const [otherUser, testUser] = await Promise.all([userFixture(), userFixture()]);

    const testHeaders = await signInAs(testUser.email, testUser.password);

    const [otherUserCourse, testUserCourse] = await Promise.all([
      courseFixture({ isPublished: true, organizationId: organization.id }),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    await Promise.all([
      courseUserFixture({
        courseId: otherUserCourse.id,
        userId: otherUser.id,
      }),
      courseUserFixture({
        courseId: testUserCourse.id,
        userId: testUser.id,
      }),
    ]);

    const result = await listUserCourses(testHeaders);

    expect(result.error).toBeNull();
    expect(result.data?.some((item) => item.id === testUserCourse.id)).toBe(true);
    expect(result.data?.some((item) => item.id === otherUserCourse.id)).toBe(false);
  });
});
