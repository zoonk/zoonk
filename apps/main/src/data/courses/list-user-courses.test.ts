import { prisma } from "@zoonk/db";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { listUserCourses } from "./list-user-courses";

describe("unauthenticated users", () => {
  it("returns an empty array", async () => {
    const courses = await listUserCourses();

    expect(courses).toStrictEqual([]);
  });
});

describe("authenticated users", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;
  let user: Awaited<ReturnType<typeof userFixture>>;

  beforeAll(async () => {
    [organization, user] = await Promise.all([organizationFixture(), userFixture()]);
  });

  beforeEach(async () => {
    await signInAsCurrentUser({ email: user.email, password: user.password });
  });

  it("returns empty array when user has no courses", async () => {
    const newUser = await userFixture();
    await signInAsCurrentUser({ email: newUser.email, password: newUser.password });

    const courses = await listUserCourses();

    expect(courses).toStrictEqual([]);
  });

  it("includes courses where the user has not completed a lesson", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    await courseUserFixture({ courseId: course.id, userId: user.id });

    const courses = await listUserCourses();

    expect(courses.some((item) => item.id === course.id)).toBe(true);
  });

  it("includes the organization in the response", async () => {
    const testUser = await userFixture();
    await signInAsCurrentUser({ email: testUser.email, password: testUser.password });

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    await courseUserFixture({ courseId: course.id, userId: testUser.id });

    const courses = await listUserCourses();

    const returnedCourse = courses.find((item) => item.id === course.id);
    expect(returnedCourse?.organization).toBeDefined();
    expect(returnedCourse?.organization?.id).toBe(organization.id);
    expect(returnedCourse?.organization?.slug).toBe(organization.slug);
  });

  it("orders courses by startedAt descending (most recent first)", async () => {
    const testUser = await userFixture();
    await signInAsCurrentUser({ email: testUser.email, password: testUser.password });

    const [course1, course2, course3] = await Promise.all([
      courseFixture({ isPublished: true, organizationId: organization.id }),
      courseFixture({ isPublished: true, organizationId: organization.id }),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

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

    const courses = await listUserCourses();

    expect(courses).toHaveLength(3);

    const courseIds = courses.map((item) => item.id);
    expect(courseIds).toStrictEqual([course2.id, course3.id, course1.id]);
  });

  it("excludes courses from non-brand organizations", async () => {
    const testUser = await userFixture();
    await signInAsCurrentUser({ email: testUser.email, password: testUser.password });

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

    const courses = await listUserCourses();

    expect(courses.some((item) => item.id === brandCourse.id)).toBe(true);
    expect(courses.some((item) => item.id === schoolCourse.id)).toBe(false);
  });

  it("includes personal courses with null organization", async () => {
    const testUser = await userFixture();
    await signInAsCurrentUser({ email: testUser.email, password: testUser.password });

    const personalCourse = await courseFixture({
      isPublished: true,
      organizationId: null,
      userId: testUser.id,
    });

    await courseUserFixture({ courseId: personalCourse.id, userId: testUser.id });

    const courses = await listUserCourses();

    expect(courses.some((item) => item.id === personalCourse.id)).toBe(true);
  });

  it("does not return other users courses", async () => {
    const [otherUser, testUser] = await Promise.all([userFixture(), userFixture()]);

    await signInAsCurrentUser({ email: testUser.email, password: testUser.password });

    const [otherUserCourse, testUserCourse] = await Promise.all([
      courseFixture({ isPublished: true, organizationId: organization.id }),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    await Promise.all([
      courseUserFixture({ courseId: otherUserCourse.id, userId: otherUser.id }),
      courseUserFixture({ courseId: testUserCourse.id, userId: testUser.id }),
    ]);

    const courses = await listUserCourses();

    expect(courses.some((item) => item.id === testUserCourse.id)).toBe(true);
    expect(courses.some((item) => item.id === otherUserCourse.id)).toBe(false);
  });
});
