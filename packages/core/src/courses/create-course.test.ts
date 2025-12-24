import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { memberFixture, organizationFixture } from "@/fixtures/orgs";
import { createCourse } from "./create-course";

describe("unauthenticated users", () => {
  test("returns Unauthorized", async () => {
    const organization = await organizationFixture();

    const result = await createCourse({
      description: "Test description",
      headers: new Headers(),
      language: "en",
      orgSlug: organization.slug,
      slug: "test-course",
      title: "Test Course",
    });

    expect(result.error?.message).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });
});

describe("non-existent organization", () => {
  test("returns Organization not found", async () => {
    const { user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);

    const result = await createCourse({
      description: "Test description",
      headers,
      language: "en",
      orgSlug: "non-existent-org",
      slug: "test-course",
      title: "Test Course",
    });

    expect(result.error?.message).toBe("Organization not found");
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);

    const result = await createCourse({
      description: "Test description",
      headers,
      language: "en",
      orgSlug: organization.slug,
      slug: "test-course",
      title: "Test Course",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  test("creates course successfully", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    const result = await createCourse({
      description: "Test description",
      headers,
      language: "en",
      orgSlug: organization.slug,
      slug,
      title: "Test Course",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.title).toBe("Test Course");
    expect(result.data?.description).toBe("Test description");
    expect(result.data?.language).toBe("en");
    expect(result.data?.organizationId).toBe(organization.id);
  });

  test("normalizes slug", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);

    const result = await createCourse({
      description: "Test description",
      headers,
      language: "en",
      orgSlug: organization.slug,
      slug: "My Test Course!",
      title: "My Test Course",
    });

    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe("my-test-course");
  });

  test("normalizes title for search", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    const result = await createCourse({
      description: "Test description",
      headers,
      language: "pt",
      orgSlug: organization.slug,
      slug,
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
    const slug = `test-course-${randomUUID()}`;

    const result = await createCourse({
      description: "Owner's course",
      headers,
      language: "pt",
      orgSlug: organization.slug,
      slug,
      title: "Owner Course",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.title).toBe("Owner Course");
  });
});

describe("duplicate slug", () => {
  test("returns error when slug already exists for same language and org", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    await createCourse({
      description: "First course",
      headers,
      language: "en",
      orgSlug: organization.slug,
      slug,
      title: "First Course",
    });

    const result = await createCourse({
      description: "Duplicate course",
      headers,
      language: "en",
      orgSlug: organization.slug,
      slug,
      title: "Duplicate Course",
    });

    expect(result.error).not.toBeNull();
  });

  test("allows same slug for different language", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    await createCourse({
      description: "English course",
      headers,
      language: "en",
      orgSlug: organization.slug,
      slug,
      title: "English Course",
    });

    const result = await createCourse({
      description: "Portuguese course",
      headers,
      language: "pt",
      orgSlug: organization.slug,
      slug,
      title: "Portuguese Course",
    });

    expect(result.error).toBeNull();
    expect(result.data?.language).toBe("pt");
  });
});
