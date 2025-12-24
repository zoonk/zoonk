import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { courseFixture } from "@/fixtures/courses";
import { memberFixture, organizationFixture } from "@/fixtures/orgs";
import { getCourse } from "./get-course";

describe("brand org: unauthenticated users", async () => {
  const organization = await organizationFixture({ kind: "brand" });

  const [publishedCourse, draftCourse] = await Promise.all([
    courseFixture({ isPublished: true, organizationId: organization.id }),
    courseFixture({ isPublished: false, organizationId: organization.id }),
  ]);

  test("returns Forbidden for visibility all", async () => {
    const result = await getCourse({
      courseSlug: draftCourse.slug,
      headers: new Headers(),
      language: draftCourse.language,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for visibility draft", async () => {
    const result = await getCourse({
      courseSlug: draftCourse.slug,
      headers: new Headers(),
      language: draftCourse.language,
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns published course for visibility published", async () => {
    const result = await getCourse({
      courseSlug: publishedCourse.slug,
      headers: new Headers(),
      language: publishedCourse.language,
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(publishedCourse.id);
  });
});

describe("non-brand orgs: unauthenticated users", async () => {
  const organization = await organizationFixture({ kind: "school" });

  const course = await courseFixture({
    isPublished: true,
    organizationId: organization.id,
  });

  test("returns Forbidden for visibility published", async () => {
    const result = await getCourse({
      courseSlug: course.slug,
      headers: new Headers(),
      language: course.language,
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("org members", async () => {
  const { organization, user } = await memberFixture({ role: "member" });

  const [headers, draftCourse, publishedCourse] = await Promise.all([
    signInAs(user.email, user.password),
    courseFixture({ isPublished: false, organizationId: organization.id }),
    courseFixture({
      isPublished: true,
      language: "en",
      organizationId: organization.id,
    }),
  ]);

  test("returns Forbidden for visibility draft", async () => {
    const result = await getCourse({
      courseSlug: draftCourse.slug,
      headers,
      language: draftCourse.language,
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for visibility all", async () => {
    const result = await getCourse({
      courseSlug: draftCourse.slug,
      headers,
      language: draftCourse.language,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns published course for visibility published", async () => {
    const result = await getCourse({
      courseSlug: publishedCourse.slug,
      headers,
      language: publishedCourse.language,
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(publishedCourse.id);
    expect(result.data?.title).toBe(publishedCourse.title);
  });

  test("returns null when course does not exist", async () => {
    const result = await getCourse({
      courseSlug: "non-existent-course",
      headers,
      language: "en",
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when language does not match", async () => {
    const result = await getCourse({
      courseSlug: publishedCourse.slug,
      headers,
      language: "pt",
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when organization does not match", async () => {
    const otherOrg = await organizationFixture();

    const result = await getCourse({
      courseSlug: publishedCourse.slug,
      headers,
      language: publishedCourse.language,
      orgSlug: otherOrg.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });
});

describe("org admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });

  const [headers, course] = await Promise.all([
    signInAs(user.email, user.password),
    courseFixture({ isPublished: false, organizationId: organization.id }),
  ]);

  test("returns course for visibility draft", async () => {
    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
    expect(result.data?.title).toBe(course.title);
  });

  test("returns course for visibility all", async () => {
    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
  });

  test("returns null when course does not exist", async () => {
    const result = await getCourse({
      courseSlug: "non-existent-course",
      headers,
      language: "en",
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });
});
