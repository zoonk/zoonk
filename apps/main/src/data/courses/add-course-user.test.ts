import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { addCourseUser } from "./add-course-user";

describe("unauthenticated users", () => {
  test("returns Unauthorized", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
    });

    const result = await addCourseUser({
      courseId: course.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe(ErrorCode.unauthorized);
    expect(result.data).toBeNull();
  });
});

describe("authenticated users", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;
  let user: Awaited<ReturnType<typeof userFixture>>;
  let headers: Headers;
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    [organization, user] = await Promise.all([organizationFixture(), userFixture()]);

    [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({
        isPublished: true,
        organizationId: organization.id,
      }),
    ]);
  });

  test("adds a course to user successfully", async () => {
    const result = await addCourseUser({
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.courseId).toBe(course.id);
    expect(result.data?.userId).toBe(Number(user.id));
  });

  test("is idempotent (adding same course twice does not error)", async () => {
    const newCourse = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    const firstResult = await addCourseUser({
      courseId: newCourse.id,
      headers,
    });

    const secondResult = await addCourseUser({
      courseId: newCourse.id,
      headers,
    });

    expect(firstResult.error).toBeNull();
    expect(secondResult.error).toBeNull();
    expect(firstResult.data?.id).toBe(secondResult.data?.id);

    const count = await prisma.courseUser.count({
      where: {
        courseId: newCourse.id,
        userId: Number(user.id),
      },
    });

    expect(count).toBe(1);
  });

  test("creates a record in the database", async () => {
    const newCourse = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    await addCourseUser({
      courseId: newCourse.id,
      headers,
    });

    const record = await prisma.courseUser.findUnique({
      where: {
        courseUser: {
          courseId: newCourse.id,
          userId: Number(user.id),
        },
      },
    });

    expect(record).not.toBeNull();
    expect(record?.courseId).toBe(newCourse.id);
    expect(record?.userId).toBe(Number(user.id));
    expect(record?.startedAt).toBeInstanceOf(Date);
  });
});
