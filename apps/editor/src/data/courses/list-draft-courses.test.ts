import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { listDraftCourses } from "./list-draft-courses";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();

    await Promise.all([
      courseFixture({ isPublished: true, organizationId: organization.id }),
      courseFixture({ isPublished: false, organizationId: organization.id }),
    ]);

    const result = await listDraftCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});

describe("non members", () => {
  test("returns Forbidden", async () => {
    const [organization, { user }] = await Promise.all([
      organizationFixture(),
      memberFixture({ role: "member" }),
    ]);

    const headers = await signInAs(user.email, user.password);

    const result = await listDraftCourses({
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});

describe("org members", () => {
  test("returns Forbidden for org members", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const [headers] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ isPublished: false, organizationId: organization.id }),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const result = await listDraftCourses({
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});

describe("org admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let draftCourse: Awaited<ReturnType<typeof courseFixture>>;
  let publishedCourse: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    [headers, draftCourse, publishedCourse] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      courseFixture({
        isPublished: false,
        organizationId: fixture.organization.id,
      }),
      courseFixture({
        isPublished: true,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("returns only draft courses", async () => {
    const result = await listDraftCourses({
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(draftCourse.id);
    expect(result.data.every((c) => c.isPublished === false)).toBe(true);
  });

  test("does not return published courses", async () => {
    const result = await listDraftCourses({
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(
      result.data.find((c) => c.id === publishedCourse.id),
    ).toBeUndefined();
  });

  test("filters by language", async () => {
    await courseFixture({
      isPublished: false,
      language: "pt",
      organizationId: organization.id,
    });

    const result = await listDraftCourses({
      headers,
      language: "en",
      orgSlug: organization.slug,
    });

    const hasPtCourse = result.data.some((course) => course.language === "pt");

    expect(result.error).toBeNull();
    expect(hasPtCourse).toBe(false);
  });

  test("returns all draft courses without limit", async () => {
    await prisma.course.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        description: `Draft Course ${i} description`,
        imageUrl: "https://example.com/image.jpg",
        isPublished: false,
        language: "de",
        normalizedTitle: `draft course ${i}`,
        organizationId: organization.id,
        slug: `draft-course-${organization.id}-${i}`,
        title: `Draft Course ${i}`,
      })),
    });

    const result = await listDraftCourses({
      headers,
      language: "de",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(25);
  });

  test("does not include organization data in results", async () => {
    const result = await listDraftCourses({
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data[0]).not.toHaveProperty("organization");
  });
});
