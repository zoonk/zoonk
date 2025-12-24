import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { courseAttrs } from "@/fixtures/courses";
import { memberFixture, organizationFixture } from "@/fixtures/orgs";
import { createCourse } from "./create-course";

describe("unauthenticated users", () => {
  test("returns Unauthorized", async () => {
    const organization = await organizationFixture();
    const attrs = courseAttrs();

    const result = await createCourse({
      ...attrs,
      headers: new Headers(),
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });
});

describe("non-existent organization", () => {
  test("returns Organization not found", async () => {
    const { user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const attrs = courseAttrs();

    const result = await createCourse({
      ...attrs,
      headers,
      orgSlug: "non-existent-org",
    });

    expect(result.error?.message).toBe("Organization not found");
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const attrs = courseAttrs();

    const result = await createCourse({
      ...attrs,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  test("creates course successfully", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
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
    expect(result.data?.description).toBe(attrs.description);
    expect(result.data?.language).toBe(attrs.language);
    expect(result.data?.organizationId).toBe(organization.id);
  });

  test("normalizes slug", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
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
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
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

describe("duplicate slug", () => {
  test("returns error when slug already exists for same language and org", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
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

  test("allows same slug for different language", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
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

    expect(result.error).toBeNull();
    expect(result.data?.language).toBe("pt");
  });
});
