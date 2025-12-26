import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { searchOrgChapters } from "./search-org-chapters";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();

  test("returns Forbidden", async () => {
    const result = await searchOrgChapters({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "test",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("members", async () => {
  const { organization, user } = await memberFixture({ role: "member" });
  const headers = await signInAs(user.email, user.password);

  test("returns Forbidden", async () => {
    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "test",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });
  const headers = await signInAs(user.email, user.password);

  test("searches all chapters in organization by title", async () => {
    await Promise.all([
      chapterFixture({
        organizationId: organization.id,
        title: "Learn JavaScript Basics",
      }),
      chapterFixture({
        organizationId: organization.id,
        title: "Advanced Python Techniques",
      }),
      chapterFixture({
        organizationId: organization.id,
        title: "JavaScript Functions",
      }),
    ]);

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "javascript",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(2);
  });

  test("searches with normalized title (removes accents)", async () => {
    await chapterFixture({
      organizationId: organization.id,
      title: "Introdução à Programação",
    });

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "programacao",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(
      result.data.some((c) => c.title === "Introdução à Programação"),
    ).toBe(true);
  });

  test("returns empty array when no matches", async () => {
    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "xyznonexistentxyz",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("only returns chapters from the specified organization", async () => {
    const otherOrg = await organizationFixture();

    await Promise.all([
      chapterFixture({
        organizationId: otherOrg.id,
        title: "Other Org Unique Chapter",
      }),
      chapterFixture({
        organizationId: organization.id,
        title: "My Org Unique Chapter",
      }),
    ]);

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "Unique Chapter",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.title).toBe("My Org Unique Chapter");
  });

  test("returns Forbidden for different organization", async () => {
    const otherOrg = await organizationFixture();

    const result = await searchOrgChapters({
      headers,
      orgSlug: otherOrg.slug,
      title: "test",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});
