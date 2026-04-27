import { ErrorCode } from "@/lib/app-error";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseAttrs } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { createCourse } from "./create-course";

describe("unauthenticated users", () => {
  test("returns Unauthorized", async () => {
    const organization = await organizationFixture();

    const result = await createCourse({
      ...courseAttrs(),
      headers: new Headers(),
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.unauthorized);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);

    const result = await createCourse({
      ...courseAttrs(),
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("creates course successfully", async () => {
    const attrs = courseAttrs();

    const result = await createCourse({
      ...attrs,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.title).toBe(attrs.title);
    expect(result.data?.description).toBe(attrs.description);
    expect(result.data?.language).toBe(attrs.language);
    expect(result.data?.organizationId).toBe(organization.id);
  });

  test("normalizes slug", async () => {
    const attrs = courseAttrs();

    const result = await createCourse({
      ...attrs,
      headers,
      orgSlug: organization.slug,
      slug: "My Test Course!",
    });

    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe("my-test-course");
  });

  test("normalizes title for search", async () => {
    const attrs = courseAttrs();

    const result = await createCourse({
      ...attrs,
      headers,
      orgSlug: organization.slug,
      title: "Ciência da Computação",
    });

    expect(result.error).toBeNull();
    expect(result.data?.normalizedTitle).toBe("ciencia da computacao");
  });

  test("returns Organization not found", async () => {
    const result = await createCourse({
      ...courseAttrs(),
      headers,
      orgSlug: "non-existent-org",
    });

    expect(result.error?.message).toBe(ErrorCode.organizationNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow to create course for a different organization", async () => {
    const otherOrg = await organizationFixture();

    const result = await createCourse({
      ...courseAttrs(),
      headers,
      orgSlug: otherOrg.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("returns error when slug already exists for same org", async () => {
    const attrs = courseAttrs();

    await createCourse({
      ...attrs,
      headers,
      orgSlug: organization.slug,
    });

    const result = await createCourse({
      ...attrs,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).not.toBeNull();
  });

  test("returns error when slug already exists even for different language", async () => {
    const attrs = courseAttrs();

    await createCourse({
      ...attrs,
      headers,
      language: "en",
      orgSlug: organization.slug,
    });

    const result = await createCourse({
      ...attrs,
      headers,
      language: "pt",
      orgSlug: organization.slug,
    });

    expect(result.error).not.toBeNull();
  });
});

describe("owners", () => {
  test("creates course successfully", async () => {
    const { organization, user } = await memberFixture({ role: "owner" });
    const headers = await signInAs(user.email, user.password);
    const attrs = courseAttrs();

    const result = await createCourse({
      ...attrs,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.title).toBe(attrs.title);
  });
});
