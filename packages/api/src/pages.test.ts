import { describe, expect, test, vi } from "vitest";
import { pageFixture, pageMemberFixture } from "@/fixtures/pages";
import { userFixture } from "@/fixtures/users";
import { canAddPage, canEditPage, getPage } from "./pages";
import * as users from "./users";

describe("getPage()", () => {
  test("retrieves a page by slug", async () => {
    const params = await pageFixture();
    const page = await getPage(params.slug);

    expect(page).not.toBeNull();
    expect(page?.slug).toBe(params.slug);
    expect(page?.name).toBe(params.name);
  });
});

describe("canAddPage()", () => {
  test("returns false when there is no session", async () => {
    vi.spyOn(users, "getSession").mockResolvedValueOnce(null);
    expect(await canAddPage()).toBe(false);
  });

  test("returns true when there is a session", async () => {
    vi.spyOn(users, "getSession").mockResolvedValueOnce({} as any);
    expect(await canAddPage()).toBe(true);
  });
});

describe("canEditPage()", () => {
  test("returns false when there is no session", async () => {
    vi.spyOn(users, "getSession").mockResolvedValueOnce(null);

    const params = await pageFixture();
    const canEdit = await canEditPage(params.slug);

    expect(canEdit).toBe(false);
  });

  test("returns false for editors", async () => {
    const [user, page] = await Promise.all([userFixture(), pageFixture()]);

    vi.spyOn(users, "getSession").mockResolvedValueOnce({ user } as any);

    await pageMemberFixture({
      pageId: page.id,
      role: "editor",
      userId: user.id,
    });

    const canEdit = await canEditPage(page.slug);

    expect(canEdit).toBe(false);
  });

  test("returns true for admins", async () => {
    const [user, page] = await Promise.all([userFixture(), pageFixture()]);

    vi.spyOn(users, "getSession").mockResolvedValueOnce({ user } as any);

    await pageMemberFixture({
      pageId: page.id,
      role: "admin",
      userId: user.id,
    });

    const canEdit = await canEditPage(page.slug);

    expect(canEdit).toBe(true);
  });
});
