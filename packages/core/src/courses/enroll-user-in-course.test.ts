import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { enrollUserInCourse } from "./enroll-user-in-course";

describe(enrollUserInCourse, () => {
  it("creates the course enrollment and increments the user count", async () => {
    const [course, user] = await Promise.all([courseFixture(), userFixture()]);

    await enrollUserInCourse({ courseId: course.id, userId: user.id });

    const [courseUser, updatedCourse] = await Promise.all([
      prisma.courseUser.findUnique({
        where: { courseUser: { courseId: course.id, userId: user.id } },
      }),
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ]);

    expect(courseUser).not.toBeNull();
    expect(updatedCourse.userCount).toBe(1);
  });

  it("creates one enrollment when called concurrently", async () => {
    const [course, user] = await Promise.all([courseFixture(), userFixture()]);
    const enrollment = { courseId: course.id, userId: user.id };

    await Promise.all([
      enrollUserInCourse(enrollment),
      enrollUserInCourse(enrollment),
      enrollUserInCourse(enrollment),
    ]);

    const [courseUsers, updatedCourse] = await Promise.all([
      prisma.courseUser.findMany({ where: enrollment }),
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ]);

    expect(courseUsers).toHaveLength(1);
    expect(updatedCourse.userCount).toBe(1);
  });
});
