import { ErrorCode } from "@/lib/app-error";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { getCourse } from "./get-course";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    const result = await getCourse({
      courseSlug: course.slug,
      headers: new Headers(),
      language: course.language,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("non members", () => {
  test("returns Forbidden", async () => {
    const [organization, { user }] = await Promise.all([
      organizationFixture(),
      memberFixture({ role: "member" }),
    ]);

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({
        isPublished: true,
        organizationId: organization.id,
      }),
    ]);

    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("org members", () => {
  test("returns forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: organization.id,
      }),
    ]);

    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("org admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    [headers, course] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      courseFixture({
        isPublished: false,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("returns draft course", async () => {
    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
    expect(result.data?.title).toBe(course.title);
  });

  test("returns null when course does not exist", async () => {
    const result = await getCourse({
      courseSlug: "non-existent-course",
      headers,
      language: "en",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when language does not match", async () => {
    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: "pt",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when organization does not match", async () => {
    const otherOrg = await organizationFixture();

    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: otherOrg.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });
});
