import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { courseFixture } from "@/fixtures/courses";
import { memberFixture, organizationFixture } from "@/fixtures/orgs";
import { getCourse } from "./get-course";

describe("brand org: unauthenticated users", () => {
  test("returns Forbidden for visibility all", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const result = await getCourse({
      courseSlug: course.slug,
      headers: new Headers(),
      language: course.language,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for visibility draft", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const result = await getCourse({
      courseSlug: course.slug,
      headers: new Headers(),
      language: course.language,
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns published course for visibility published", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    const result = await getCourse({
      courseSlug: course.slug,
      headers: new Headers(),
      language: course.language,
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
  });
});

describe("brand org: members", () => {
  test("returns Forbidden for visibility draft", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ isPublished: false, organizationId: organization.id }),
    ]);

    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns published course for visibility published", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
    expect(result.data?.title).toBe(course.title);
  });

  test("returns null when course does not exist", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });

    const headers = await signInAs(user.email, user.password);

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
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ language: "en", organizationId: organization.id }),
    ]);

    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: "pt",
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when organization does not match", async () => {
    const [org1, { organization: org2, user }] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      memberFixture({ orgKind: "brand", role: "member" }),
    ]);

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ organizationId: org1.id }),
    ]);

    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: org2.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });
});

describe("brand org: admins", () => {
  test("returns draft course for visibility draft", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ isPublished: false, organizationId: organization.id }),
    ]);

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
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ isPublished: false, organizationId: organization.id }),
    ]);

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
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });

    const headers = await signInAs(user.email, user.password);

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

describe("school org: unauthenticated users", () => {
  test("returns Forbidden for visibility published", async () => {
    const organization = await organizationFixture({ kind: "school" });

    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

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

describe("school org: non-members", () => {
  test("returns Forbidden for visibility published", async () => {
    const [organization, { user }] = await Promise.all([
      organizationFixture({ kind: "school" }),
      memberFixture({ role: "member" }),
    ]);

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const result = await getCourse({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});
