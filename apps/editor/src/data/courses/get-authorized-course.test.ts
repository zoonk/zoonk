import { ErrorCode } from "@/lib/app-error";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { getAuthorizedActiveCourse } from "./get-authorized-course";

describe(getAuthorizedActiveCourse, () => {
  test("returns the active course for admins", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ organizationId: organization.id }),
    ]);

    const result = await getAuthorizedActiveCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
    expect(result.data?.organization.slug).toBe(organization.slug);
  });

  test("returns courseNotFound for archived courses", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({
        archivedAt: new Date(),
        organizationId: organization.id,
      }),
    ]);

    const result = await getAuthorizedActiveCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
    expect(result.data).toBeNull();
  });
});
